import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminLayout } from "./admin/AdminLayout";
import { ApplicationDetailPage } from "./admin/applications/ApplicationDetailPage";
import { ApplicationsPage } from "./admin/applications/ApplicationsPage";
import { NewApplicationPage } from "./admin/applications/NewApplicationPage";
import { DashboardPage } from "./admin/DashboardPage";
import { CombinedReportPage } from "./admin/evaluations/CombinedReportPage";
import { IncubationEvaluationPage } from "./admin/evaluations/IncubationEvaluationPage";
import { LeaderboardPage } from "./admin/evaluations/LeaderboardPage";
import { PreIncubationEvaluationPage } from "./admin/evaluations/PreIncubationEvaluationPage";
import { LoginPage } from "./admin/LoginPage";
import { RecordsPage, RecordsRoute } from "./admin/records/RecordsPage";
import { StartupDetailPage } from "./admin/startups/StartupDetailPage";
import { StartupFormPage } from "./admin/startups/StartupFormPage";
import { StartupsPage } from "./admin/startups/StartupsPage";
import { WakeBanner } from "./components/WakeBanner";
import { RequireAuth } from "./lib/AuthProvider";
import { ApplyPage } from "./public/ApplyPage";
import { HomePage } from "./public/HomePage";
import { NotFoundPage } from "./public/NotFoundPage";
import { PublicLayout } from "./public/PublicLayout";

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

/** Old shared links used "?view=form" for the applicant form. */
function LegacyFormRedirect({ children }) {
  const { search } = useLocation();
  if (new URLSearchParams(search).get("view") === "form") return <Navigate to="/apply/pre-incubation" replace />;
  return children;
}

const programRoutes = (program, base) => (
  <>
    <Route path={`${base}/applications`} element={<ApplicationsPage key={`${program}/applications`} view={`${program}/applications`} />} />
    <Route path={`${base}/applications/new`} element={<NewApplicationPage key={program} program={program} />} />
    <Route path={`${base}/applications/:id`} element={<ApplicationDetailPage key={program} program={program} />} />
  </>
);

export default function App() {
  return (
    <>
      <ScrollToTop />
      <WakeBanner />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route
            index
            element={
              <LegacyFormRedirect>
                <HomePage />
              </LegacyFormRedirect>
            }
          />
          <Route path="apply/:program" element={<ApplyPage />} />
        </Route>

        <Route path="admin/login" element={<LoginPage />} />
        <Route
          path="admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />

          {programRoutes("preincubation", "pre-incubation")}
          <Route path="pre-incubation/applications/:id/evaluation" element={<PreIncubationEvaluationPage />} />
          <Route path="pre-incubation/startups" element={<ApplicationsPage key="pre/startups" view="preincubation/startups" />} />
          <Route path="pre-incubation/graduated" element={<ApplicationsPage key="pre/graduated" view="preincubation/graduated" />} />
          <Route path="pre-incubation/enquiries" element={<RecordsPage module="enquiry" category="preincubation" />} />

          {programRoutes("incubation", "incubation")}
          <Route path="incubation/applications/:id/evaluations/:evalId" element={<IncubationEvaluationPage />} />
          <Route path="incubation/applications/:id/report" element={<CombinedReportPage />} />
          <Route path="incubation/leaderboard" element={<LeaderboardPage />} />
          <Route path="incubation/startups" element={<StartupsPage key="all" />} />
          <Route path="incubation/startups/new" element={<StartupFormPage />} />
          <Route path="incubation/startups/:id" element={<StartupDetailPage />} />
          <Route path="incubation/startups/:id/edit" element={<StartupFormPage />} />
          <Route path="incubation/graduated" element={<StartupsPage key="graduated" graduated />} />
          <Route path="incubation/enquiries" element={<RecordsPage module="enquiry" category="incubation" />} />

          {programRoutes("internship", "internship")}
          <Route path="internship/interns" element={<ApplicationsPage key="intern/current" view="internship/interns" />} />
          <Route path="internship/past" element={<ApplicationsPage key="intern/past" view="internship/past" />} />
          <Route path="internship/enquiries" element={<RecordsPage module="enquiry" category="internship" />} />

          <Route path="records/:module/:category" element={<RecordsRoute />} />
          <Route path="*" element={<NotFoundPage home="/admin" />} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
