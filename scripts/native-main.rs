// Original test driver. Upstream Zed definitions and macros are fetched separately.
use std::{env, fs};
use collections::{BTreeMap, BTreeSet};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use settings_macros::{MergeFrom, with_fallible_options};
mod fallible_options;
mod merge_from;
mod upstream_ssh;
include!("native_types.rs");

fn inspect(text: &str) -> serde_json::Value {
    let (parsed, status) = fallible_options::parse_json::<RemoteSettingsContent>(text);
    match status {
        ParseStatus::Success => {
            let settings = parsed.expect("Success must have parsed settings");
            let connections = settings.ssh_connections.unwrap_or_default();
            serde_json::json!({"status":"accepted", "connections":connections})
        }
        ParseStatus::Failed { error } => serde_json::json!({"status":"rejected", "error":error}),
        ParseStatus::Unchanged => panic!("Unexpected unchanged result from fresh parse"),
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    assert_eq!(args.len(), 3, "Provide explicit synthetic fixture and generated fragment paths");
    let fixture: serde_json::Value = serde_json::from_str(&fs::read_to_string(&args[1]).unwrap()).unwrap();
    let fragment_text = fs::read_to_string(&args[2]).unwrap();
    let fragment: serde_json::Value = serde_json::from_str(&fragment_text).unwrap();
    for c in fragment["ssh_connections"].as_array().unwrap() {
        assert!(c["host"].as_str().unwrap().ends_with(".invalid"), "Synthetic .invalid hosts only");
    }
    let root_text = fixture["files"].as_array().unwrap().iter()
        .find(|f| f["path"] == fixture["root"]).unwrap()["content"].as_str().unwrap();
    let root_suggestions = upstream_ssh::parse_ssh_config_hosts(root_text);
    assert_eq!(root_suggestions, BTreeSet::from(["local-dev.invalid".to_owned()]));
    let accepted = inspect(&fragment_text);
    assert_eq!(accepted["status"], "accepted");
    let values = accepted["connections"].as_array().unwrap();
    let hosts: Vec<_> = values.iter().map(|x| x["host"].as_str().unwrap()).collect();
    assert_eq!(hosts, vec!["local-dev.invalid", "work-dev.invalid", "work-alt.invalid", "build-box.invalid"]);
    assert_eq!(values[0]["username"], "existing-synthetic-user");
    assert_eq!(values[0]["port"], 2200);
    assert_eq!(values[0]["args"], serde_json::json!(["-o","BatchMode=yes"]));
    assert_eq!(values[0]["projects"], serde_json::json!([{"paths":["~/code/local"]}]));
    assert_eq!(values[1]["nickname"], "Existing work nickname");
    assert_eq!(values[1]["projects"], serde_json::json!([{"paths":["~/code/keep-work"]}]));
    assert_eq!(values[2]["projects"], serde_json::json!([{"paths":["~/code/new-work"]}]));
    assert_eq!(values[2]["nickname"], "Work alternate");
    assert_eq!(values[3]["projects"], serde_json::json!([{"paths":["/srv/synthetic/build"]}]));
    for c in &values[2..] {
        assert_eq!(c["args"], serde_json::json!([]));
        for field in ["username", "port", "upload_binary_over_ssh", "port_forwards", "connection_timeout"] {
            assert!(c.get(field).is_none(), "New connection unexpectedly has {field}");
        }
    }
    assert_eq!(&fragment["ssh_connections"][0], &fixture["existing"]["ssh_connections"][0]);
    assert_eq!(&fragment["ssh_connections"][1], &fixture["existing"]["ssh_connections"][1]);
    let mut negatives = Vec::new();
    for (name, bad) in [
        ("host-number", serde_json::json!({"ssh_connections":[{"host":42}]})),
        ("missing-host", serde_json::json!({"ssh_connections":[{"projects":[]}]})),
        ("paths-wrong-type", serde_json::json!({"ssh_connections":[{"host":"bad.invalid","projects":[{"paths":42}]}]})),
        ("optional-nickname-recovery-is-not-success", serde_json::json!({"ssh_connections":[{"host":"bad.invalid","nickname":42}]})),
        ("port-overflow", serde_json::json!({"ssh_connections":[{"host":"bad.invalid","port":70000}]})),
        ("connections-wrong-type", serde_json::json!({"ssh_connections":"wrong"})),
    ] {
        let result = inspect(&bad.to_string());
        assert_eq!(result["status"], "rejected", "Negative control unexpectedly accepted: {name}");
        negatives.push(serde_json::json!({"name":name,"result":result}));
    }
    for (name, field) in [("downloaded-new-project-corrupted", "projects"), ("downloaded-new-host-corrupted", "host")] {
        let mut bad = fragment.clone();
        bad["ssh_connections"][2][field] = serde_json::json!(42);
        let result = inspect(&bad.to_string());
        assert_eq!(result["status"], "rejected", "Actual fragment corruption unexpectedly accepted");
        negatives.push(serde_json::json!({"name":name,"result":result}));
    }
    println!("{}", serde_json::to_string_pretty(&serde_json::json!({
        "zed_tag":"v1.22.0", "zed_commit":"76659a55a8c10ed355a070f8764a0b1733e3c115",
        "consumer":"Actual extracted upstream RemoteSettingsContent + SshConnection types with unchanged settings_macros/fallible_options",
        "valid_fragment":accepted, "negative_controls":negatives,
        "root_only_suggestions":root_suggestions, "network_ssh_attempts":0,
        "scope":"Deserialization and pinned root-only suggestions only; no GUI, SSH connection, or full SettingsStore validation"
    })).unwrap());
}
