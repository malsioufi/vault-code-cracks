import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Online from "./pages/Online.tsx";
import Solo from "./pages/Solo.tsx";
import Room from "./pages/Room.tsx";
import Auth from "./pages/Auth.tsx";
import Daily from "./pages/Daily.tsx";
import Stats from "./pages/Stats.tsx";
import Achievements from "./pages/Achievements.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import PublicProfile from "./pages/PublicProfile.tsx";
import Account from "./pages/Account.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/online" element={<Online />} />
            <Route path="/solo" element={<Solo />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/room/:code" element={<Room />} />
            <Route path="/profile/:userId" element={<PublicProfile />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
