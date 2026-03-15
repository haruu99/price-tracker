import "./globals.css";

export const metadata = {
  title: "Competitor Price Tracker",
  description: "Track competitor prices across public product pages and get alerted when they change."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
