module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '\\.[jt]sx?$': ['babel-jest', {
      configFile: false,
      presets: ['babel-preset-expo'],
      plugins: ['react-native-reanimated/plugin'],
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|immer|zustand)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 60,   // signInWithGoogle requires real browser — excluded from unit target
      functions: 78,
      lines: 75,
      statements: 73,
    },
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
