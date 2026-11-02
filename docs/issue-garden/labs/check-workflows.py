"""Exercise the tutorial's actual guards with local, disposable fixtures.

Requires Python 3, Git, Node.js and pnpm. Uses no credentials or network.
This does not test GitHub runner isolation, artifact APIs or model behavior.
"""

import copy
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap


DOCS = Path(__file__).resolve().parents[1]
API = (DOCS / '05-codex-api.md').read_text()
AW = (DOCS / '06-agentic-workflows.md').read_text()
ALLOWED = [
    'features/resume-editor/application/resume-document-codec.ts',
    'tests/unit/resume-document-codec.test.ts',
]


def python_blocks(markdown):
    return [textwrap.dedent(match.group(2)) for match in re.finditer(
        r"(?m)^([ ]*)python3 - <<'PY'\n(.*?)^\1PY$", markdown, re.S)]


def digest(issue):
    task = {key: issue.get(key) or '' for key in ('title', 'body')}
    encoded = json.dumps(task, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(args, cwd, env, expected=0):
    result = subprocess.run(args, cwd=cwd, env=env, text=True, capture_output=True, timeout=60)
    if expected is not None:
        require(result.returncode == expected, f'{args}: exit {result.returncode}\n{result.stderr}\n{result.stdout}')
    return result


def git(cwd, env, *args):
    return run(['git', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', *args], cwd, env)


def main():
    for command in ('git', 'node', 'pnpm'):
        require(shutil.which(command), f'Missing command: {command}')
    api_guards, aw_guards = python_blocks(API), python_blocks(AW)
    require(len(api_guards) == 3 and len(aw_guards) == 1, 'Tutorial guard layout changed; update the regression extractor')
    checks = [item.strip().strip("'\"") for item in re.search(
        r'^\s+check: \[([^\]]+)\]$', API, re.M).group(1).split(',')]
    require(set(checks) == {'check:architecture', 'test:unit', 'lint', 'typecheck', 'build'}, 'Unexpected validation matrix')
    apply_step = re.search(
        r'      - name: Apply and independently check scope\n        run: \|\n(.*?)(?=^      - )',
        API, re.M | re.S).group(1)
    apply_step = textwrap.dedent(apply_step)
    check_step = re.search(r'^        run: (pnpm run "\$CHECK_COMMAND")$', API, re.M).group(1)

    with tempfile.TemporaryDirectory(prefix='issue-workflow-check-') as temporary:
        work = Path(temporary)
        env = {
            'PATH': os.environ['PATH'], 'RUNNER_TEMP': temporary,
            'ISSUE_NUMBER': '123', 'ALLOWED_FILES': '\n'.join(ALLOWED),
            'GITHUB_OUTPUT': str(work / 'outputs.txt'), 'PYTHONOPTIMIZE': '1',
            'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_NOSYSTEM': '1',
            'GIT_ATTR_NOSYSTEM': '1', 'GIT_TERMINAL_PROMPT': '0',
            'GIT_AUTHOR_NAME': 'Local audit', 'GIT_AUTHOR_EMAIL': 'audit@example.invalid',
            'GIT_COMMITTER_NAME': 'Local audit', 'GIT_COMMITTER_EMAIL': 'audit@example.invalid',
            'npm_config_userconfig': str(work / 'npmrc'), 'npm_config_store_dir': str(work / 'store'),
            'npm_config_offline': 'true', 'COREPACK_ENABLE_NETWORK': '0', 'CI': 'true',
        }
        (work / 'npmrc').write_text('offline=true\n')
        (work / 'pr-heads.txt').write_text('')
        accepted = {'state': 'open', 'title': '修复一个问题', 'body': '已审阅的复现与验收。'}
        env['APPROVED_ISSUE_SHA256'] = digest(accepted)
        for route, code in [('api', api_guards[0]), ('aw', aw_guards[0])]:
            approved = {**accepted, 'labels': [{'name': 'ai-ready'}, {'name': 'ai-route-' + route}]}
            for case in ('approved', 'missing-label', 'closed', 'pr', 'changed-title', 'changed-body', 'metadata-only'):
                issue = copy.deepcopy(approved)
                if case == 'missing-label': issue['labels'] = issue['labels'][1:]
                if case == 'closed': issue['state'] = 'closed'
                if case == 'pr': issue['pull_request'] = {}
                if case == 'changed-title': issue['title'] += ' 未批准的变化'
                if case == 'changed-body': issue['body'] += ' 未批准的变化'
                if case == 'metadata-only': issue['updated_at'] = '2026-11-02T00:00:00Z'
                filename = 'issue.json' if route == 'api' else '.issue-task.json'
                (work / filename).write_text(json.dumps(issue))
                result = run([sys.executable, '-c', code], work, env, expected=None)
                should_pass = case in ('approved', 'metadata-only')
                require((result.returncode == 0) == should_pass, f'{route}: incorrect decision for {case}')
            if route == 'aw':
                for head, should_pass in [('experiment/aw-issue-123-result', False), ('experiment/aw-issue-1234-result', True)]:
                    (work / 'pr-heads.txt').write_text(head + '\n')
                    result = run([sys.executable, '-c', code], work, env, expected=None)
                    require((result.returncode == 0) == should_pass, f'AW duplicate check: {head}')
        print('PASS: issue approval, state, labels and AW prior delivery guards')

        repo = work / 'baseline'
        repo.mkdir()
        for filename in ALLOWED:
            path = repo / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('export const fixture = true;\n')
        (repo / 'README.md').write_text('Fixture\n')
        config = {'name': 'issue-guard-fixture', 'private': True, 'type': 'module', 'scripts': {
            'check:architecture': 'node -e "process.exit(0)"',
            'test:unit': 'node tests/unit/resume-document-codec.test.ts',
            'lint': 'node -e "process.exit(23)"',
            'typecheck': 'node -e "process.exit(24)"',
            'build': 'node -e "process.exit(25)"',
        }}
        (repo / 'package.json').write_text(json.dumps(config, indent=2) + '\n')
        (repo / '.gitignore').write_text('node_modules/\n')
        run(['pnpm', 'install', '--offline', '--ignore-scripts'], repo, env)
        git(repo, env, 'init', '-q')
        git(repo, env, 'add', '.')
        git(repo, env, 'commit', '-qm', 'local fixture')
        candidate = work / 'candidate'
        candidate.mkdir()
        (candidate / 'issue.json').write_text(json.dumps(accepted))
        for case in ('allowed', 'outside', 'symlink', 'deleted'):
            git(repo, env, 'reset', '--hard', '-q', 'HEAD')
            if case == 'allowed': (repo / ALLOWED[0]).write_text('export const fixture = false;\n')
            if case == 'outside': (repo / 'README.md').write_text('Outside scope\n')
            if case == 'symlink':
                path = repo / ALLOWED[0]
                path.unlink()
                path.symlink_to('../../../README.md')
            if case == 'deleted': (repo / ALLOWED[1]).unlink()
            generated = run([sys.executable, '-c', api_guards[1]], repo, env, expected=None)
            git(repo, env, 'add', '-A')
            verified = run([sys.executable, '-c', api_guards[2]], repo, env, expected=None)
            require((generated.returncode == 0) == (case == 'allowed'), f'Generation scope: {case}')
            require((verified.returncode == 0) == (case == 'allowed'), f'Verification scope: {case}')
        print('PASS: allowed files, out-of-scope edits, symlinks and deletions')

        git(repo, env, 'reset', '--hard', '-q', 'HEAD')
        (repo / ALLOWED[1]).write_text("""import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL('../../package.json', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf8'));
for (const name of ['lint', 'typecheck', 'build']) config.scripts[name] = 'node -e "process.exit(0)"';
writeFileSync(path, JSON.stringify(config, null, 2) + '\\n');
""")
        run([sys.executable, '-c', api_guards[1]], repo, env)
        shutil.copyfile(work / 'change.patch', candidate / 'change.patch')
        git(repo, env, 'reset', '--hard', '-q', 'HEAD')
        expected = {'check:architecture': 0, 'test:unit': 0, 'lint': 23, 'typecheck': 24, 'build': 25}
        for index, check in enumerate(checks):
            checkout = work / f'check-{index}'
            git(work, env, 'clone', '-q', '--no-hardlinks', str(repo), str(checkout))
            run(['pnpm', 'install', '--frozen-lockfile'], checkout, env)
            run(['bash', '--noprofile', '--norc', '-eo', 'pipefail', '-c', apply_step], checkout, env)
            run(['bash', '--noprofile', '--norc', '-eo', 'pipefail', '-c', check_step], checkout,
                {**env, 'CHECK_COMMAND': check}, expected=expected[check])
        print('PASS: runtime test edits cannot turn other fresh-checkout checks green')
    print('Local fixtures removed. No remote workflow, credential or model invocation was used.')


if __name__ == '__main__':
    main()
