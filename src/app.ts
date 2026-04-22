import { createApp } from './lib/create-app';
import { authRoute } from './routes/auth/router';

const app = createApp().route('/auth', authRoute);

export default app;

export type AppType = typeof app;
