// Reading issues from GitHub, through gh, for the configured repo.
import { execFileSync } from 'node:child_process';
import { config, ghCommand } from './config.mjs';

const gh = (...a) => execFileSync(...ghCommand([...a, '-R', config().repo]), { encoding: 'utf8' });
const ghJSON = (...a) => JSON.parse(gh(...a));

// An issue's title, on one line.
export const title = (n) => gh('issue', 'view', String(n), '--json', 'title', '-q', '.title').replace(/\s+/g, ' ').trim();

// reader's link to an issue: gh:owner/name#N[gh-N].
export const link = (n) => `gh:${config().repo}#${n}[gh-${n}]`;

// What stands in the way of starting issue n, and what to do first.
export function standing(n, milestone) {
  const issue = ghJSON('issue', 'view', String(n), '--json', 'title,body,labels,milestone,state');
  // GitHub's search for the number is loose, so these are PRs to look at, not proof.
  const prs = ghJSON('pr', 'list', '--state', 'open', '--search', `${n} in:title,body`, '--json', 'number,title,author');
  const label = issue.labels.some((l) => l.name === 'good first issue');
  return {
    n,
    title: issue.title,
    body: issue.body ?? '',
    closed: issue.state !== 'OPEN',
    label,
    prs,
    outside: milestone && issue.milestone?.title !== milestone ? issue.milestone?.title ?? 'none' : null,
  };
}

// An issue's body, as GitHub markdown, kept as it is but for what reader would
// read as its own: headings go down two levels, so the issue's own section holds
// them, and a line that would be an aside, a card, a field, a vote, a block or a
// page break is escaped. Fences are left alone.
export function asSection(body) {
  let fence = null;
  return body.replace(/\r\n/g, '\n').trim().split('\n').map((line) => {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) { if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; return line; }
    if (f) { fence = f[1]; return line; }
    const h = /^(#{1,6})([ \t].*)$/.exec(line);
    if (h) return `${'#'.repeat(Math.min(6, h[1].length + 2))}${h[2]}`;
    return /^(?:~|!|@[ \t]|:::|\+\+\+|\+1\b|-{3,}\s*$|(?:Q|A|Good|Bad|Try)(?:[ \t]*\([^)]*\))?:)/.test(line) ? `\\${line}` : line;
  }).join('\n');
}
