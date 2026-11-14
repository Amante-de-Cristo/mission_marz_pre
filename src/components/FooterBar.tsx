import React from 'react';
import { ExternalLink } from 'lucide-react';

export const FooterBar: React.FC = () => {
  return (
    <footer
      data-testid="persistent-footer"
      className="h-9 shrink-0 z-50 px-4 bg-[#10101A] border-t border-[#2A2442] flex items-center justify-between gap-3 text-[11px] text-[#9F8FC7] select-none whitespace-nowrap"
    >
      <div className="flex items-center gap-2 min-w-0">
        <img
          src="/assets/aistudio/logo_new_f57edc92.png"
          alt="Cosmic Cupcake"
          className="w-4 h-4 rounded-full object-cover border border-[#5B2C98] shrink-0"
        />
        <span className="shrink-0">Made by</span>
        <a
          href="https://sites.google.com/view/cosmic-cupcake/home"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="footer-cosmic-cupcake-link"
          className="text-[#A78BFA] hover:text-[#E9D5FF] hover:underline flex items-center gap-1 font-bold transition-colors shrink-0"
        >
          <span>Cosmic Cupcake</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>

      <div className="hidden sm:block text-[11px] text-[#8E7DB8] truncate">
        Interactive 3D Mars Base Simulator
      </div>
    </footer>
  );
};
