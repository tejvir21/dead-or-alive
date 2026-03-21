import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-void-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="font-display text-[120px] leading-none neon-text-red opacity-30">404</div>
        <h1 className="font-display text-4xl tracking-wider text-white mt-4 mb-2">ROOM NOT FOUND</h1>
        <p className="font-body text-gray-500 mb-8">You wandered into a void. This room doesn't exist.</p>
        <Link to="/" className="btn-primary">RETURN TO SAFETY</Link>
      </motion.div>
    </div>
  );
}
