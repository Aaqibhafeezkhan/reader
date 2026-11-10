// Stands in for gh in the tests, through READER_GH: answers the few calls the scripts
// make from the JSON file READER_GH_DATA, and appends each call's arguments to
// READER_GH_LOG, a line of JSON each.
//   { "default": "acme/reader" | null,
//     "issues": { "12": { "title", "body", "state", "milestone", "labels": ["good first issue"] } },
//     "prs": [{ "number", "title", "body", "author" }] }
// Run with no arguments, as the test runner does to every file in test/, it does nothing.
import fs from 'node:fs';

const args = process.argv.slice(2);
if (args.length) {
  if (process.env.READER_GH_LOG) fs.appendFileSync(process.env.READER_GH_LOG, `${JSON.stringify(args)}\n`);
  const data = JSON.parse(fs.readFileSync(process.env.READER_GH_DATA, 'utf8'));
  const opt = (name) => args[args.indexOf(name) + 1];
  const say = (v) => process.stdout.write(typeof v === 'string' ? `${v}\n` : JSON.stringify(v));
  const [what, verb] = args;
  if (what === 'repo' && verb === 'set-default') {
    // As gh does when none is set: a sentence, not a repo.
    say(data.default ?? 'X No default remote repository has been set.');
  } else if (what === 'issue' && verb === 'view') {
    const issue = data.issues[args[2]];
    if (!issue) {
      process.stderr.write(`GraphQL: Could not resolve to an issue with the number of ${args[2]}.\n`);
      process.exit(1);
    }
    const full = {
      title: issue.title,
      body: issue.body ?? '',
      state: issue.state ?? 'OPEN',
      milestone: issue.milestone ? { title: issue.milestone } : null,
      labels: (issue.labels ?? []).map((name) => ({ name })),
    };
    say(args.includes('-q') ? full[opt('-q').slice(1)] : Object.fromEntries(opt('--json').split(',').map((k) => [k, full[k]])));
  } else if (what === 'pr' && verb === 'list') {
    const n = opt('--search').split(' ')[0];
    say((data.prs ?? []).filter((p) => new RegExp(`\\b${n}\\b`).test(`${p.title} ${p.body ?? ''}`))
      .map((p) => ({ number: p.number, title: p.title, author: { login: p.author } })));
  } else {
    process.stderr.write(`fake gh: no answer for ${args.join(' ')}\n`);
    process.exit(1);
  }
}
