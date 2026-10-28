// All routes. Paths are full site paths: the server shows this app at /login and /sbm/... .
// Pages come from config/resources.tsx; a page not built yet shows ComingSoonPage.

import { Authenticated, CanAccess } from "@refinedev/core";
import { CatchAllNavigate } from "@refinedev/react-router";
import { Spin } from "antd";
import { Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";

import { appResources } from "@/config/resources";
import ForgotPasswordPage from "@/features/auth/ForgotPasswordPage";
import GoAfterLogin from "@/features/auth/GoAfterLogin";
import LoginPage from "@/features/auth/LoginPage";
import ComingSoonPage from "@/features/home/ComingSoonPage";
import NotFoundPage, { NoAccessPage } from "@/features/home/NotFoundPage";
import PageErrorBoundary from "@/features/home/PageErrorBoundary";
import AppLayout from "@/layout/AppLayout";
import { HOME, LOGIN } from "@/lib/redirect";
import { homePath } from "@/lib/roles";

const pages = appResources.filter((r) => r.path);

export default function AppRoutes() {
	return (
		<Routes>
			{/* Login pages: a logged-in user is sent on. */}
			<Route
				element={
					<Authenticated key="public" fallback={<Outlet />}>
						<GoAfterLogin />
					</Authenticated>
				}
			>
				<Route path={LOGIN} element={<LoginPage />} />
				<Route path={`${HOME}/forgot-password`} element={<ForgotPasswordPage />} />
			</Route>

			{/* The app: logged in only, otherwise login, remembering the page. */}
			<Route
				path={HOME}
				element={
					<Authenticated key="app" fallback={<CatchAllNavigate to={LOGIN} />}>
						<AppLayout />
					</Authenticated>
				}
			>
				<Route index element={<Navigate to={homePath()} replace />} />
				{pages
					.filter((page) => page.detail)
					.map((page) => (
						<Route
							key={`${page.name}-detail`}
							path={`${page.path!.slice(HOME.length + 1)}/*`}
							element={
								<CanAccess
									resource={page.name}
									action="list"
									fallback={<NoAccessPage />}
								>
									<PageErrorBoundary key={`${page.name}-detail`}>
										<Suspense fallback={<Spin size="large" />}>
											{page.detail && <page.detail />}
										</Suspense>
									</PageErrorBoundary>
								</CanAccess>
							}
						/>
					))}
				{pages.map((page) => (
					<Route
						key={page.name}
						path={page.path!.slice(HOME.length + 1)}
						element={
							<CanAccess
								resource={page.name}
								action="list"
								fallback={<NoAccessPage />}
							>
								<PageErrorBoundary key={page.name}>
									{page.page ? (
										<Suspense fallback={<Spin size="large" />}>
											<page.page />
										</Suspense>
									) : (
										<ComingSoonPage resource={page} />
									)}
								</PageErrorBoundary>
							</CanAccess>
						}
					/>
				))}
				<Route path="login" element={<Navigate to={LOGIN} replace />} />
				<Route path="*" element={<NotFoundPage />} />
			</Route>

			<Route path="*" element={<Navigate to={HOME} replace />} />
		</Routes>
	);
}
