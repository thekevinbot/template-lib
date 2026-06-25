//! PyO3 binding — this *is* the idiomatic Python SDK. The Pythonic surface (a frozen-ish
//! `Entry`, a `WordCountError` exception, `len()`/`in`, keyword args) is expressed directly via
//! PyO3 macros; there is no separate veneer. No counting logic here — everything delegates to the
//! shared Rust core.

use pyo3::create_exception;
use pyo3::exceptions::PyException;
use pyo3::prelude::*;

use mynewproduct::Counter as CoreCounter;

create_exception!(_mynewproduct, WordCountError, PyException);

/// A word and how many times it occurred.
#[pyclass(frozen, eq)]
#[derive(PartialEq, Eq)]
struct Entry {
    #[pyo3(get)]
    word: String,
    #[pyo3(get)]
    count: u64,
}

#[pymethods]
impl Entry {
    #[new]
    fn new(word: String, count: u64) -> Self {
        Entry { word, count }
    }

    fn __repr__(&self) -> String {
        format!("Entry(word={:?}, count={})", self.word, self.count)
    }
}

/// Tallies word frequencies over text streamed in via [`Counter::add`].
#[pyclass]
struct Counter {
    inner: CoreCounter,
}

#[pymethods]
impl Counter {
    #[new]
    #[pyo3(signature = (*, case_sensitive = false))]
    fn new(case_sensitive: bool) -> Self {
        Counter { inner: CoreCounter::new(case_sensitive) }
    }

    fn add(&mut self, text: &str) {
        self.inner.add(text);
    }

    fn count(&self, word: &str) -> u64 {
        self.inner.count(word)
    }

    #[getter]
    fn total(&self) -> u64 {
        self.inner.total()
    }

    fn __len__(&self) -> usize {
        self.inner.distinct() as usize
    }

    fn __contains__(&self, word: &str) -> bool {
        self.inner.count(word) > 0
    }

    fn entries(&self) -> Vec<Entry> {
        self.inner.entries().into_iter().map(|e| Entry { word: e.word, count: e.count }).collect()
    }

    fn most_common(&self, n: i64) -> PyResult<Vec<Entry>> {
        self.inner
            .most_common(n)
            .map(|v| v.into_iter().map(|e| Entry { word: e.word, count: e.count }).collect())
            .map_err(|e| WordCountError::new_err(e.to_string()))
    }

    fn __repr__(&self) -> String {
        format!("Counter(total={}, distinct={})", self.inner.total(), self.inner.distinct())
    }
}

/// The CLI, run in-process via the shared Rust implementation. Returns the exit code.
#[pyfunction]
fn run_cli(args: Vec<String>) -> i32 {
    mynewproduct::run_cli(args)
}

#[pymodule]
fn _mynewproduct(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<Counter>()?;
    m.add_class::<Entry>()?;
    m.add("WordCountError", m.py().get_type_bound::<WordCountError>())?;
    m.add_function(wrap_pyfunction!(run_cli, m)?)?;
    m.add("__version__", mynewproduct::VERSION)?;
    Ok(())
}
