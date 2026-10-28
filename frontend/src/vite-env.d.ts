/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL?: string;
	readonly VITE_USE_MOCK?: string;
	readonly VITE_MOCK_USER?: 'guest' | 'customer';
	readonly VITE_MOCK_RECOMMENDATION_ERROR?: string;
	readonly VITE_MOCK_CHAT_ERROR?: string;
	readonly VITE_MOCK_CART_MODE?: 'empty' | 'multiple' | 'changes' | 'network-error';
	readonly VITE_MOCK_ORDER_CREATE_MODE?: 'normal' | 'out-of-stock' | 'store-unavailable' | 'network-error';
	readonly VITE_MOCK_VOUCHER_MODE?: 'normal' | 'invalid' | 'expired' | 'minimum' | 'used' | 'network-error';
	readonly VITE_MOCK_TRANSFER_STATUS?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
	readonly VITE_MOCK_CARD_STATUS?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
	readonly VITE_MOCK_PAYMENT_STATUS?: 'PENDING' | 'SUCCESS' | 'FAILED';
	readonly VITE_MOCK_TRACKING_MODE?: 'normal' | 'failed' | 'network-error';
	readonly VITE_MOCK_DELIVERY_ADDRESS_MODE?: 'auto' | 'inside' | 'outside';
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
