import { Redirect } from 'expo-router';

// "โต๊ะสด" merged into orders screen — redirect to avoid empty route
export default function Index() {
  return <Redirect href="/(pos)/orders" />;
}
