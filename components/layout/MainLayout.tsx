import React from 'react';

interface MainLayoutProps {
  header: React.ReactNode;
  left: React.ReactNode;
  canvas: React.ReactNode;
  right: React.ReactNode;
  settings?: React.ReactNode;
  contextMenu?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  header,
  left,
  canvas,
  right,
  settings,
  contextMenu,
}) => {
  return (
    <div className="flex flex-col h-screen antialiased bg-dark-bg text-dark-text-primary">
      {header}
      <div className="flex flex-1 overflow-hidden">
        {left}
        {canvas}
        {right}
      </div>
      {settings}
      {contextMenu}
    </div>
  );
};

export default MainLayout;
