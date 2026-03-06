import { Redirect } from 'expo-router';

// Hidden route — redirect to dashboard (first visible tab)
export default function Index() {
  return <Redirect href="/(pos)/dashboard" />;
}
