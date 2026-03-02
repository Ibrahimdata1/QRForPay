-- Migration: Add payment confirmation tracking and push notification support
-- Run with: psql <connection_string> -f add_confirmation_tracking.sql

-- payments table: track how and by whom a payment was confirmed
ALTER TABLE payments
  ADD COLUMN confirmation_type TEXT CHECK (confirmation_type IN ('manual', 'auto')),
  ADD COLUMN confirmed_by UUID REFERENCES profiles(id);

-- profiles table: store Expo push notification token
ALTER TABLE profiles
  ADD COLUMN push_token TEXT;
