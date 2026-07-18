/**
 * Notification — Animated toast notification system
 */
import React from "react";
import { motion } from "framer-motion";

const typeStyles = {
  info: {
    border: "border-blue-700/50",
    bg: "bg-blue-900/30",
    icon: "ℹ",
    text: "text-blue-300",
  },
  success: {
    border: "border-green-700/50",
    bg: "bg-green-900/30",
    icon: "✓",
    text: "text-green-300",
  },
  warning: {
    border: "border-yellow-700/50",
    bg: "bg-yellow-900/30",
    icon: "⚠",
    text: "text-yellow-300",
  },
  error: {
    border: "border-red-700/50",
    bg: "bg-red-900/30",
    icon: "✕",
    text: "text-red-300",
  },
  elimination: {
    border: "border-red-600/60",
    bg: "bg-red-900/40",
    icon: "💀",
    text: "text-red-300",
  },
};

export default function Notification({ notification }) {
  const style = typeStyles[notification?.type] || typeStyles.info;

  return (
    <motion.div
      key={notification?.id}
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`fixed top-4 right-4 z-[9999] max-w-sm flex items-center gap-3
        px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg
        ${style.border} ${style.bg}`}
    >
      <span className="text-lg flex-shrink-0">{style.icon}</span>
      <p className={`font-body text-sm ${style.text}`}>{notification?.msg}</p>
    </motion.div>
  );
}
