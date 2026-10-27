/** stream's mark: a dot that's live, with the signal going out from it. */
export function Logo({ ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' aria-label='stream' {...props}>
      <rect width='32' height='32' rx='8' className='fill-primary' />
      <circle cx='16' cy='16' r='3.5' className='fill-primary-foreground' />
      <path
        d='M10.5 10.5a7.8 7.8 0 0 0 0 11M21.5 10.5a7.8 7.8 0 0 1 0 11M7 7a12.7 12.7 0 0 0 0 18M25 7a12.7 12.7 0 0 1 0 18'
        fill='none'
        strokeWidth='2'
        strokeLinecap='round'
        className='stroke-primary-foreground'
      />
    </svg>
  );
}
