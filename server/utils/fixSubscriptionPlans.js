require('dotenv').config();
const mongoose = require('mongoose');
const GameSettings = require('../models/GameSettings');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const settings = await GameSettings.getSingleton();

    settings.subscriptionPlans = [
        {
            name: 'pro', label: 'Pro', price: 199, currency: 'INR', durationDays: 30,
            features: ['Extended daily limits', 'Verified badge', 'Beta access (on request)']
        },
        {
            name: 'elite', label: 'Elite', price: 499, currency: 'INR', durationDays: 30,
            features: ['Unlimited rooms', 'Auto beta access', 'Priority support', 'Nightmare curves']
        },
    ];
    await settings.save();

    console.log('✅ subscriptionPlans repaired:', settings.subscriptionPlans);
    process.exit(0);
})();