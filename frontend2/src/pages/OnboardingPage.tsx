import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { organizationApi } from '@/api/organization.api';
import { workspaceApi } from '@/api/workspace.api';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { useAuthStore } from '@/features/auth/store';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';

export function OnboardingPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { setCurrentOrgId } = useOrganizationStore();

    const [orgName, setOrgName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // 1. Create Organization
            const { data: org } = await organizationApi.createOrganization({
                name: orgName.trim()
            });

            // 2. Auto-create "General" Workspace
            await workspaceApi.createWorkspace(org.id, {
                name: 'general',
                displayName: 'General'
            });

            // 3. Set Context and Redirect
            setCurrentOrgId(org.id);
            navigate(`/orgs/${org.id}/dashboard`);
        } catch (err) {
            console.error(err);
            setError('Failed to create organization. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header Icon */}
                <div className="mx-auto w-12 h-12 bg-[var(--card)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-8 shadow-sm">
                    <Building2 className="w-6 h-6 text-[var(--text-secondary)]" />
                </div>

                {/* Main Content */}
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">
                        Welcome to LuminaOps{user?.name ? `, ${user.name}` : ''}!
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        To get started, let's create your first organization.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-2 shadow-sm">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <div className="relative">
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Acme Corp"
                                className="w-full px-4 py-3 bg-transparent text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] outline-none text-lg"
                                autoFocus
                                disabled={isSubmitting}
                            />
                        </div>
                    </form>
                </div>

                {/* Action Button & Error */}
                <div className="mt-6 flex flex-col items-center gap-4">
                    {error && (
                        <p className="text-sm text-red-500 font-medium animate-in fade-in">
                            {error}
                        </p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!orgName.trim() || isSubmitting}
                        className={`
                            group flex items-center gap-2 pl-6 pr-5 py-2.5 rounded-full font-medium transition-all duration-300
                            ${orgName.trim()
                                ? 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 shadow-md hover:shadow-lg translate-y-0'
                                : 'bg-[var(--muted)] text-[var(--text-secondary)] cursor-not-allowed'
                            }
                        `}
                    >
                        {isSubmitting ? (
                            <>
                                Setting up
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </>
                        ) : (
                            <>
                                Create Organization
                                <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${orgName.trim() ? 'group-hover:translate-x-1' : ''}`} />
                            </>
                        )}
                    </button>

                    <p className="text-xs text-[var(--text-secondary)]">
                        Press <span className="font-medium text-[var(--foreground)]">Enter</span> to continue
                    </p>
                </div>
            </div>
        </div>
    );
}
