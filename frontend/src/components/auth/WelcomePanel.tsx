import { motion, useReducedMotion } from 'framer-motion';
import { Leaf, TicketPercent, Truck } from 'lucide-react';
import styles from './auth.module.css';

const features = [
  { label: 'Tươi mỗi ngày', Icon: Leaf },
  { label: 'Giao đúng giờ', Icon: Truck },
  { label: 'Ưu đãi riêng', Icon: TicketPercent },
];

const reveal = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function WelcomePanel() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.aside
      className={styles['welcome-panel']}
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0.25 : 0.65, ease: 'easeOut' }}
      aria-label="Chào mừng đến với Muadee"
    >
      <span className={`${styles['welcome-orb']} ${styles['welcome-orb-top']}`} aria-hidden="true" />
      <span className={`${styles['welcome-orb']} ${styles['welcome-orb-bottom']}`} aria-hidden="true" />
      <motion.div initial="hidden" animate="visible" transition={{ staggerChildren: reduceMotion ? 0 : 0.13 }} className={styles['welcome-content']}>
        <motion.span variants={reveal} transition={{ duration: 0.45 }} className={styles['welcome-badge']}>TƯƠI NGON MỖI NGÀY</motion.span>
        <motion.h1 variants={reveal} transition={{ duration: 0.5 }}><span className={styles['welcome-title-nowrap']}>Đi chợ thông minh,</span><br />giao tươi tận nhà.</motion.h1>
        <motion.p variants={reveal} transition={{ duration: 0.5 }} className={styles['welcome-description']}>
          Chọn thực phẩm từ cửa hàng Muadee gần nhất, tích điểm thành viên và nhận hỗ trợ từ Trợ lý Muadee AI.
        </motion.p>
        <div className={styles['welcome-features']}>
          {features.map(({ label, Icon }, index) => (
            <motion.div
              key={label}
              variants={reveal}
              transition={{ duration: 0.45 }}
              className={styles['welcome-feature']}
              whileHover={reduceMotion ? undefined : { y: -4 }}
            >
              <Icon className={`${styles['feature-icon']} ${styles[`feature-icon-${index + 1}`]}`} size={22} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.aside>
  );
}