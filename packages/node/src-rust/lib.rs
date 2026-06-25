//! napi-rs binding — this *is* the idiomatic TS SDK. napi auto-camelCases names and generates
//! the `.d.ts`, so there is no separate veneer. Conventions: errors carry a `.code` (Node-native)
//! rather than custom `Error` subclasses; collections are returned as arrays. No logic here.

use napi_derive::napi;

use mynewproduct::Counter as CoreCounter;

/// A word and how many times it occurred.
#[napi(object)]
pub struct Entry {
    pub word: String,
    pub count: i64,
}

/// Tallies word frequencies over text streamed in via `add`.
#[napi(js_name = "Counter")]
pub struct Counter {
    inner: CoreCounter,
}

#[napi]
impl Counter {
    #[napi(constructor)]
    pub fn new(case_sensitive: Option<bool>) -> Self {
        Self { inner: CoreCounter::new(case_sensitive.unwrap_or(false)) }
    }

    #[napi]
    pub fn add(&mut self, text: String) {
        self.inner.add(&text);
    }

    #[napi]
    pub fn count(&self, word: String) -> i64 {
        self.inner.count(&word) as i64
    }

    /// Total tokens added.
    #[napi(getter)]
    pub fn total(&self) -> i64 {
        self.inner.total() as i64
    }

    /// Number of distinct words.
    #[napi(getter)]
    pub fn size(&self) -> i64 {
        self.inner.distinct() as i64
    }

    #[napi]
    pub fn has(&self, word: String) -> bool {
        self.inner.count(&word) > 0
    }

    /// All entries in deterministic order (count desc, then word asc).
    #[napi]
    pub fn entries(&self) -> Vec<Entry> {
        self.inner
            .entries()
            .into_iter()
            .map(|e| Entry { word: e.word, count: e.count as i64 })
            .collect()
    }

    /// The `n` most common entries. Throws an `Error` with `code === "InvalidArg"` on negative `n`.
    #[napi]
    pub fn most_common(&self, n: i64) -> napi::Result<Vec<Entry>> {
        self.inner
            .most_common(n)
            .map(|v| v.into_iter().map(|e| Entry { word: e.word, count: e.count as i64 }).collect())
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))
    }
}

#[napi]
pub fn version() -> String {
    mynewproduct::VERSION.to_string()
}

/// The CLI, run in-process via the shared Rust implementation. Returns the exit code.
#[napi]
pub fn run_cli(args: Vec<String>) -> i32 {
    mynewproduct::run_cli(args)
}
