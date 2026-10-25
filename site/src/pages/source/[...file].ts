import type { APIRoute, GetStaticPaths } from 'astro';

const sources = import.meta.glob<string>('../../../../docs/**/labs/*.{mjs,ts,wat}', {
  query: '?raw', import: 'default', eager: true,
});

export const getStaticPaths: GetStaticPaths = () =>
  Object.entries(sources).map(([file, content]) => ({
    params: { file: file.slice('../../../../docs/'.length) },
    props: { content },
  }));

export const GET: APIRoute = ({ props }) =>
  new Response(props.content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
