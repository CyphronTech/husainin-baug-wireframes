import "./globals.css";

export const metadata = { title: "Husainin Baug · Hall & Room Booking", description: "Hall and room booking for Husainin Baug: availability, bookings, payments and receipts." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
