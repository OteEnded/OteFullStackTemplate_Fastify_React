// The checks/ contract: every check file ends with EXACTLY one of
//   ALL CHECKS PASSED (n)      -> green
//   SKIPPED: <reason>          -> not run (e.g. no test database configured)
//   <n> CHECK(S) FAILED        -> red, exit code 1
// pipeline/test-all.mjs judges each file by that line, not by its exit code alone.

export function makeChecker(title) {
    let passed = 0;
    const failures = [];
    console.log(`\n${title}`);

    const check = (name, ok, detail = "") => {
        if (ok) passed += 1;
        else failures.push(`${name}${detail !== "" ? ` — ${detail}` : ""}`);
        console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail !== "" ? ` (${detail})` : ""}`);
    };

    const done = () => {
        if (failures.length === 0) {
            console.log(`\nALL CHECKS PASSED (${passed})`);
            process.exitCode = 0;
        } else {
            console.log(`\n${failures.length} CHECK(S) FAILED:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
            process.exitCode = 1;
        }
    };

    return { check, done };
}

export function skip(reason) {
    console.log(`SKIPPED: ${reason}`);
    process.exitCode = 0;
}
