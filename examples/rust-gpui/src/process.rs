use async_channel::{Receiver, Sender};
use serde_json::Value;
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, mpsc},
    time::{Duration, Instant},
};

const LINE_LIMIT: usize = 2 * 1024 * 1024;

pub enum ProcessEvent {
    Json(Value),
    Error(String),
    Closed,
}

pub struct JsonProcess {
    writer: Option<mpsc::SyncSender<String>>,
    child: Arc<Mutex<Child>>,
}

impl JsonProcess {
    pub fn spawn(
        path: &Path,
        arguments: &[String],
    ) -> Result<(Self, Receiver<ProcessEvent>), String> {
        let mut child = Command::new(path)
            .args(arguments)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|error| format!("无法启动 {}：{error}", path.display()))?;
        let Some(mut stdin) = child.stdin.take() else {
            if let Err(error) = child.kill() {
                eprintln!("Cannot clean up child: {error}");
            }
            return Err("子进程没有 stdin".into());
        };
        let Some(stdout) = child.stdout.take() else {
            if let Err(error) = child.kill() {
                eprintln!("Cannot clean up child: {error}");
            }
            return Err("子进程没有 stdout".into());
        };
        let child = Arc::new(Mutex::new(child));
        let (events, receiver) = async_channel::bounded(32);
        let reader_events = events.clone();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let mut line = Vec::new();
                let result = (&mut reader)
                    .take((LINE_LIMIT + 1) as u64)
                    .read_until(b'\n', &mut line);
                match result {
                    Ok(0) => break,
                    Ok(_) if line.len() > LINE_LIMIT => {
                        send_error(&reader_events, "子进程 JSONL 超出 2 MiB，连接已停止".into());
                        break;
                    }
                    Ok(_) => match serde_json::from_slice::<Value>(&line) {
                        Ok(value) => {
                            if reader_events
                                .send_blocking(ProcessEvent::Json(value))
                                .is_err()
                            {
                                return;
                            }
                        }
                        Err(_) => {
                            // Never print a malformed protocol line: a credential may have crossed the boundary.
                            send_error(&reader_events, "子进程返回无效 JSONL，连接已停止".into());
                            break;
                        }
                    },
                    Err(error) => {
                        send_error(&reader_events, format!("读取子进程输出失败：{error}"));
                        break;
                    }
                }
            }
            if reader_events.send_blocking(ProcessEvent::Closed).is_err() {
                return;
            }
        });
        let (writer, commands) = mpsc::sync_channel::<String>(8);
        std::thread::spawn(move || {
            while let Ok(line) = commands.recv() {
                if let Err(error) = stdin.write_all(line.as_bytes()).and_then(|_| stdin.flush()) {
                    send_error(&events, format!("发送命令失败：{error}"));
                    break;
                }
            }
            // Dropping stdin delivers EOF; both helpers treat it as cancellation.
        });
        Ok((
            Self {
                writer: Some(writer),
                child,
            },
            receiver,
        ))
    }

    pub fn send_json(&self, command: &Value) -> Result<(), String> {
        self.send_line(serde_json::to_string(command).map_err(|error| error.to_string())?)
    }

    pub fn send_line(&self, mut line: String) -> Result<(), String> {
        if line.len() > LINE_LIMIT - 1 {
            return Err("命令过大".into());
        }
        line.push('\n');
        self.writer
            .as_ref()
            .ok_or("连接已关闭")?
            .try_send(line)
            .map_err(|error| match error {
                mpsc::TrySendError::Full(_) => "命令队列已满，请稍后重试".into(),
                mpsc::TrySendError::Disconnected(_) => "子进程命令管道已关闭".into(),
            })
    }
}

fn send_error(sender: &Sender<ProcessEvent>, error: String) {
    if sender.send_blocking(ProcessEvent::Error(error)).is_err() {
        return;
    }
}

impl Drop for JsonProcess {
    fn drop(&mut self) {
        self.writer.take();
        let child = self.child.clone();
        std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(3);
            loop {
                let Ok(mut child) = child.lock() else {
                    return;
                };
                match child.try_wait() {
                    Ok(Some(_)) => return,
                    Ok(None) if Instant::now() < deadline => {}
                    Ok(None) | Err(_) => {
                        if let Err(error) = child.kill() {
                            eprintln!("Cannot terminate child: {error}");
                        }
                        if let Err(error) = child.wait() {
                            eprintln!("Cannot reap child: {error}");
                        }
                        return;
                    }
                }
                drop(child);
                std::thread::sleep(Duration::from_millis(50));
            }
        });
    }
}
