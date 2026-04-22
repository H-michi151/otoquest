// /onboarding は Sidebar・Header なしのフルスクリーンレイアウト
// RootLayout の OnboardingGuard により /onboarding はリダイレクト対象外
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // body の bg-grid-pattern は RootLayout から来ているが、
  // オンボーディングは独自背景を使うので上書き可能
  return <>{children}</>;
}
