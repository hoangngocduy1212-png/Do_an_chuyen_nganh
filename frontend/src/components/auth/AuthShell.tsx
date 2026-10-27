import { Leaf } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { WelcomePanel } from './WelcomePanel';
import styles from './auth.module.css';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className={styles['auth-page']}>
      <header className={styles['auth-header']}>
        <Link className={styles['auth-brand']} to="/" aria-label="Muadee, về trang chủ">
          <span className={styles['auth-brand-mark']}><Leaf size={22} strokeWidth={2.2} /></span>
          <span>Muadee</span>
        </Link>
        <p>Mua sắm tươi ngon, nhận hàng từ cửa hàng gần bạn</p>
      </header>
      <main className={styles['auth-main']}>
        <div className={styles['auth-grid']}>
          <WelcomePanel />
          <motion.section
            className={styles['auth-form-panel']}
            initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0.25 : 0.55, delay: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
          >
            {children}
          </motion.section>
        </div>
      </main>
    </div>
  );
}