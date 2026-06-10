import { PROVIDERS } from '@/lib/providers';
import Homepage, { type HomepageProvider } from './Homepage';

export const dynamic = 'force-static';

export default function Home() {
  const providers: HomepageProvider[] = Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.displayName,
    prefixes: config.modelPrefixes,
    models: config.models || [],
  }));

  return <Homepage providers={providers} />;
}
