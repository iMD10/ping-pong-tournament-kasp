export function KleejaIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/klija.png" alt="" className={`inline-block shrink-0 object-contain align-middle ${className}`} />
  );
}
