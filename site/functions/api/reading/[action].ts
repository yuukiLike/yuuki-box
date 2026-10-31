import { handleReadingRequest } from '../../../server/reading';

export const onRequest = ({ request, env }: { request: Request; env: ReadingEnv }) =>
  handleReadingRequest(request, env);
