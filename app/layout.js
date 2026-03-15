import "./globals.css";

export const metadata = {
  title: "Price Tracker MVP",
  description: "Track competitor prices and get alerted when they change."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
