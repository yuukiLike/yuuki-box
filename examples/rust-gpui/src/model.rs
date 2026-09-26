use semver::Version;
use serde::Deserialize;
use std::path::Path;

pub const HISTORY_LIMIT: usize = 10_200;
pub const STREAM_LIMIT: usize = 200;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Message,
    Tool,
}

#[derive(Clone, Deserialize)]
pub struct Event {
    pub id: usize,
    pub kind: Kind,
    pub text: String,
}

impl Event {
    pub fn is_tool(&self) -> bool {
        matches!(self.kind, Kind::Tool)
    }
}

pub fn read_fixture(path: &Path) -> Result<Vec<Event>, String> {
    let bytes = std::fs::read(path).map_err(|error| format!("{}: {error}", path.display()))?;
    let events: Vec<Event> = serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    if events.is_empty() {
        return Err("事件 fixture 不能为空".into());
    }
    Ok(events)
}

pub fn history(fixture: &[Event], count: usize) -> Vec<Event> {
    fixture
        .iter()
        .cycle()
        .take(count)
        .enumerate()
        .map(|(index, event)| {
            let mut event = event.clone();
            event.id = index + 1;
            event
        })
        .collect()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Update {
    pub schema_version: u32,
    pub version: String,
    pub notes: String,
    pub url: String,
}

pub fn validate_update(json: &str, current: &str) -> Result<Option<Update>, String> {
    let update: Update = serde_json::from_str(json).map_err(|error| error.to_string())?;
    if update.schema_version != 1 {
        return Err("不支持的更新清单 schemaVersion".into());
    }
    if update.notes.trim().is_empty() {
        return Err("更新说明不能为空".into());
    }
    let url = url::Url::parse(&update.url).map_err(|error| format!("无效的更新 URL: {error}"))?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("更新 URL 必须是无凭据的 HTTPS 地址".into());
    }
    let version =
        Version::parse(&update.version).map_err(|error| format!("无效的远程版本: {error}"))?;
    let current = Version::parse(current).map_err(|error| format!("无效的本地版本: {error}"))?;
    Ok((version > current).then_some(update))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest(version: &str, url: &str) -> String {
        serde_json::json!({"schemaVersion": 1, "version": version, "notes": "Changes", "url": url})
            .to_string()
    }

    #[test]
    fn compares_semver_numerically_and_handles_prereleases() {
        assert!(
            validate_update(&manifest("0.10.0", "https://example.com"), "0.2.0")
                .unwrap()
                .is_some()
        );
        assert!(
            validate_update(&manifest("0.2.0-beta.1", "https://example.com"), "0.2.0")
                .unwrap()
                .is_none()
        );
        assert!(
            validate_update(&manifest("0.1.0", "https://example.com"), "0.1.0")
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn rejects_invalid_manifest_and_unsafe_urls() {
        for json in [
            "{}".to_string(),
            manifest("banana", "https://example.com"),
            manifest("0.2.0", "file:///tmp/app"),
            manifest("0.2.0", "https://user:password@example.com"),
        ] {
            assert!(validate_update(&json, "0.1.0").is_err());
        }
        let invalid = manifest("0.2.0", "https://example.com")
            .replace("\"schemaVersion\":1", "\"schemaVersion\":2");
        assert!(validate_update(&invalid, "0.1.0").is_err());
    }

    #[test]
    fn expands_fixtures_without_duplicate_ids() {
        let events = vec![Event {
            id: 42,
            kind: Kind::Tool,
            text: "Tool result".into(),
        }];
        let result = history(&events, 10_000);
        assert_eq!(result.len(), 10_000);
        assert_eq!(result[9_999].id, 10_000);
        assert!(result.iter().all(Event::is_tool));
        assert!(history(&[], 1000).is_empty());
    }
}
