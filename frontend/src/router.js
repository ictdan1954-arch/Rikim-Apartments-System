import { authService } from './services/auth.service.js';

class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.pageContent = document.getElementById('page-content');
        this.pageTitle = document.getElementById('page-title');
        
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    addRoute(path, config) {
        this.routes[path] = config;
    }

    async handleRoute() {
        const hash = window.location.hash.slice(1) || '/login';
        const [path, queryString] = hash.split('?');
        
        // Parse query params
        const params = {};
        if (queryString) {
            queryString.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                params[key] = decodeURIComponent(value);
            });
        }

        // Find matching route
        let route = this.routes[path];
        if (!route) {
            // Check for parameterized routes
            for (const [routePath, routeConfig] of Object.entries(this.routes)) {
                const pattern = routePath.replace(/:\w+/g, '([^/]+)');
                const regex = new RegExp(`^${pattern}$`);
                const match = path.match(regex);
                if (match) {
                    route = routeConfig;
                    // Extract params from URL
                    const paramNames = (routePath.match(/:\w+/g) || []).map(p => p.slice(1));
                    paramNames.forEach((name, index) => {
                        params[name] = match[index + 1];
                    });
                    break;
                }
            }
        }

        if (!route) {
            this.navigate('/login');
            return;
        }

        // Check authentication
        if (route.auth && !authService.isAuthenticated()) {
            this.navigate('/login');
            return;
        }

        // Check role
        if (route.role) {
            const userRole = authService.getRole();
            if (!route.role.includes(userRole)) {
                this.navigate('/login');
                return;
            }
        }

        this.currentRoute = { path, params };
        
        // Update page title
        if (route.title) {
            this.pageTitle.textContent = route.title;
            document.title = `${route.title} - Bandaptai Apartments`;
        }

        // Show loading
        this.pageContent.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

        try {
            // Load page
            const module = await route.component();
            if (module.default) {
                await module.default(this.pageContent, params);
            }
        } catch (error) {
            console.error('Route error:', error);
            this.pageContent.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h2>Page Load Error</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary">Retry</button>
                </div>
            `;
        }
    }

    navigate(path) {
        window.location.hash = path;
    }
}

export const router = new Router();
