import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  DISCORD_TOKEN: string;
  GEMINI_API_KEY: string;
  OWNER_ID: string;
  PORT: number;
}

// Safely load configuration with fallbacks and validation
export const config: Config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OWNER_ID: process.env.OWNER_ID || '1297013439125917766',
  PORT: parseInt(process.env.PORT || '3000', 10),
};

// Validate required configuration
const validateConfig = () => {
  const required = ['DISCORD_TOKEN', 'GEMINI_API_KEY'];
  const missing = required.filter(key => !config[key as keyof Config]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('💡 Please add these to your Replit Secrets:');
    missing.forEach(key => {
      console.error(`   ${key}: <your_${key.toLowerCase()}>`);
    });
    process.exit(1);
  }
};

validateConfig();

export default config;
