import { App, Page, SnackbarProvider } from 'zmp-ui';
import 'zmp-ui/zaui.css';
import '@/styles/index.css';

// Trang tạm. GalleryPage sẽ thay thế ở task sau.
export default function AppShell() {
  return (
    <App>
      <SnackbarProvider>
        <Page>
          <div>Gymer ơi</div>
        </Page>
      </SnackbarProvider>
    </App>
  );
}
