# Agent runtime JSONL protocol v1

Implemented protocol, 2026-09-26; source compiled, runtime interactions not exercised this round. Bundled executable: `AgentRuntime.app/Contents/MacOS/agent-runtime`. Launch with `serve --route swift|gpui|react-native|webview|electron`. stdin/stdout JSONL; no API keys on argv or stdout. stdout lines <= 2 MiB. Each route has isolated sessions; settings and Keychain credential shared. UI must hold stdin open; EOF cancels the active run and exits.

Commands (one JSON object per line):

```json
{"op":"bootstrap"}
{"op":"settings.save","settings":{"apiBase":"https://api.deepseek.com","model":"deepseek-flash","maxOutputTokens":2048,"maxRounds":4,"workspace":"","speechBackend":"apple","whisperCLI":"","whisperModel":""},"apiKey":"optional replacement; empty means unchanged"}
{"op":"session.new"}
{"op":"session.select","sessionId":"uuid"}
{"op":"session.export"}
{"op":"run.start","text":"user task"}
{"op":"run.cancel"}
{"op":"approval.respond","approvalId":"uuid","allow":true}
```

Key removal: `{"op":"settings.save","clearAPIKey":true}`. Settings fields may be partial. Unknown operations/invalid inputs emit error. While busy, session switching/new/settings save are rejected; cancellation and approval remain usable.

Events:

```json
{"type":"state","state":{"settings":{"apiBase":"https://api.deepseek.com","model":"deepseek-flash","maxOutputTokens":2048,"maxRounds":4,"workspace":"","speechBackend":"apple","whisperCLI":"","whisperModel":""},"hasAPIKey":false,"busy":false,"notice":"Ready","sessions":[{"id":"uuid","title":"New session","updatedAt":"ISO8601","status":"idle"}],"session":{"id":"uuid","title":"New session","status":"idle","messages":[{"id":"uuid","role":"user|assistant|tool","content":"text","status":"complete|streaming|cancelled|error","name":"optional tool name"}],"usage":{"promptTokens":0,"completionTokens":0,"totalTokens":0,"requests":0,"unreportedRequests":0},"pendingApproval":null}}}
{"type":"delta","sessionId":"uuid","messageId":"uuid","text":"append to existing assistant message"}
{"type":"error","message":"safe human readable error"}
{"type":"export","path":"absolute local Markdown path"}
```

Before assistant deltas, a state includes that streaming message. Terminal state replaces all UI data. Session status: idle/running/waiting_approval/completed/cancelled/error/interrupted. pendingApproval when present: `{id,tool,path,preview}`. Do not persist API key in renderer/storage; keep replacement entry transient and clear after sending. Config and transcript stored locally by runtime, API key in macOS Keychain (or DEEPSEEK_API_KEY environment fallback).

Speech remains the separate native-capabilities helper. UI passes configured `--backend apple|whisper`, `--whisper-cli`, `--model`; optional `--file` for audio-file mode. Mic mode Whisper records until stdin `stop`, then transcribes; stdin `cancel`/EOF/process termination aborts. Do not use old 2.5s hard-kill after Whisper stop because local inference takes longer. transcript should have an explicit “Use as task” action, never auto-send to model.

UI minimum: task entry/send/cancel; chat/tool output; new/select session; settings incl API key/model/workspace/Whisper paths; approve/deny requested note creation; export transcript; speech backend and transcript-to-task; retain existing replay and update controls separately.
