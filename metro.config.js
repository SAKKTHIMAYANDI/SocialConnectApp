const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure proper resolver for all platforms
config.resolver.platforms = ['ios', 'android', 'native'];

module.exports = config;
