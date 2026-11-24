// Protocol: world count, start index, then zero or more directed index pairs.
// Python resolves public world and anchor IDs before passing compact indices.
use std::{io::{self, Read}, process};

fn reachable(input: &str) -> Result<Vec<usize>, &'static str> {
    let mut numbers = input.split_whitespace().map(|s| s.parse::<usize>().map_err(|_| "bad integer"));
    let count = numbers.next().ok_or("missing count")??;
    let start = numbers.next().ok_or("missing start")??;
    if count > 128 || start >= count { return Err("invalid graph size or start"); }
    let mut edges = vec![Vec::new(); count];
    while let Some(from) = numbers.next() {
        let from = from?;
        let to = numbers.next().ok_or("incomplete edge")??;
        if from >= count || to >= count { return Err("unknown world"); }
        edges[from].push(to);
    }
    let mut seen = vec![false; count];
    let mut stack = vec![start];
    while let Some(node) = stack.pop() {
        if seen[node] { continue; }
        seen[node] = true;
        stack.extend(edges[node].iter().copied());
    }
    Ok((0..count).filter(|&i| !seen[i]).collect())
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).expect("read graph");
    match reachable(&input) {
        Ok(missing) => {
            for node in missing { println!("{node}"); }
        }
        Err(message) => { eprintln!("{message}"); process::exit(2); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn directed_cycle_and_disconnected_world() {
        assert_eq!(reachable("4 0 0 1 1 2 2 0").unwrap(), vec![3]);
        assert_eq!(reachable("2 1 0 1").unwrap(), vec![0]);
    }
    #[test]
    fn rejects_bad_edge() { assert!(reachable("2 0 0 3").is_err()); }
}
