/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL?: string;
	readonly VITE_USE_MOCK?: string;
	readonly VITE_MOCK_USER?: 'guest' | 'customer';
	readonly VITE_MOCK_RECOMMENDATION_ERROR?: string;
	readonly VITE_MOCK_CHAT_ERROR?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
