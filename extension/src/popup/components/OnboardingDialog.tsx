// by nichxbt
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Checkbox } from '@base-ui/react/checkbox';

const FEATURES = [
  { icon: '❤️', title: 'Auto-Liker', desc: 'Like tweets khớp từ khoá của bạn' },
  { icon: '👋', title: 'Smart Unfollow', desc: 'Tự động bỏ theo dõi người không follow lại' },
  { icon: '🎬', title: 'Video Downloader', desc: 'Tải video từ bất kỳ tweet nào' },
  { icon: '🧵', title: 'Thread Reader', desc: 'Gỡ thread thành dạng đọc liền mạch' },
];

interface OnboardingDialogProps {
  open: boolean;
  onStart: (enablePopular: boolean) => void;
}

export function OnboardingDialog({ open, onStart }: OnboardingDialogProps) {
  const [enablePopular, setEnablePopular] = React.useState(true);

  return (
    <Dialog.Root open={open} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="xa-dialog-backdrop" />
        <Dialog.Popup className="xa-dialog-popup xa-onboarding">
          <div className="xa-onboarding-header">
            <div className="xa-crest xa-crest-lg">
              X<span className="xa-crest-accent">A</span>
            </div>
            <Dialog.Title className="xa-onboarding-title">Chào mừng đến XActions</Dialog.Title>
            <Dialog.Description className="xa-onboarding-sub">
              Tự động hoá X/Twitter không cần API fee.
            </Dialog.Description>
          </div>
          <div className="xa-onboarding-features">
            {FEATURES.map((f) => (
              <div className="xa-onboarding-feature" key={f.title}>
                <span aria-hidden="true">{f.icon}</span>
                <div>
                  <strong>{f.title}</strong>
                  <br />
                  <small>{f.desc}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="xa-onboarding-actions">
            <button type="button" className="xa-btn-primary" onClick={() => onStart(enablePopular)}>
              Bắt đầu
            </button>
            <label className="xa-checkbox-label xa-onboarding-enable">
              <Checkbox.Root checked={enablePopular} onCheckedChange={(v) => setEnablePopular(!!v)} className="xa-checkbox">
                <Checkbox.Indicator className="xa-checkbox-indicator">✓</Checkbox.Indicator>
              </Checkbox.Root>
              Bật các tính năng phổ biến
            </label>
          </div>
          <div className="xa-onboarding-footer">
            <small>
              Mở <strong>x.com</strong> để bắt đầu dùng automation. By nichxbt.
            </small>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
