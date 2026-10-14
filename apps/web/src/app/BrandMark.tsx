import { cn } from '@/lib/utils';

type BrandMarkProps = {
  className?: string;
  textClassName?: string;
};

export function BrandMark({ className, textClassName }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <span className={cn('text-[22px] font-extrabold leading-none tracking-[-0.04em] text-foreground', textClassName)}>
        openclockwork<span className="text-primary">.</span>
      </span>
    </div>
  );
}
