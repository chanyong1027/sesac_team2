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
        <div className="min-h-screen bg-[#FBFBFB] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header Icon */}
                <div className="mx-auto w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center mb-8 shadow-sm">
                    <Building2 className="w-6 h-6 text-gray-700" />
                </div>

                {/* Main Content */}
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                        Welcome to LuminaOps{user?.name ? `, ${user.name}` : ''}!
                    </h1>
                    <p className="text-gray-500">
                        To get started, let's create your first organization.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <div className="relative">
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Acme Corp"
                                className="w-full px-4 py-3 bg-transparent text-gray-900 placeholder-gray-400 outline-none text-lg"
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
                                ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-md hover:shadow-lg translate-y-0'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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

                    <p className="text-xs text-gray-400">
                        Press <span className="font-medium text-gray-500">Enter</span> to continue
                    </p>
                </div>
            </div>
        </div>
    );
}
