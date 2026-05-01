import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NCFSettings } from '@/components/settings/ncf-settings';
import { UsersSettings } from '@/components/settings/users-settings';
import { UnitTypesSettings } from '@/components/settings/unit-types-settings';
import { ProductTypesSettings } from '@/components/settings/product-types-settings';
import { ExpenseCategoriesSettings } from '@/components/settings/expense-categories-settings';
import { EcfSettings } from '@/components/settings/ecf-settings';
import { ContingencyPanel } from '@/components/settings/contingency-panel';
import { getNCFSequences, getUsers, getUnitTypes, getProductTypes, getExpenseCategories, getProductTypeCatalog } from '@/lib/actions/settingsActions';
import { requireSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const unitTypes = await getUnitTypes();
    const productTypes = await getProductTypes();
    const productTypeCatalog = await getProductTypeCatalog();
    const expenseCategories = await getExpenseCategories();
    const ncfSequences = await getNCFSequences();
    const users = await getUsers();

    const session = await requireSession();
    const isGerente = session.role === 'Gerente';

    return (
        <div className="mx-auto max-w-5xl space-y-4 pb-10 md:space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Configuración</h1>
                <p className="mt-1 text-sm text-muted-foreground md:text-base">Administre las preferencias generales del sistema.</p>
            </div>

            <Tabs defaultValue="inventory" className="w-full">
                <div className="overflow-x-auto pb-2">
                    <TabsList className={`mb-4 grid h-auto w-full gap-1 md:mb-8 ${isGerente ? 'grid-cols-2 md:max-w-md' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'}`}>
                        <TabsTrigger value="inventory" className="min-w-24">Inventario</TabsTrigger>
                        <TabsTrigger value="expenses" className="min-w-24">Gastos</TabsTrigger>
                        {!isGerente && <TabsTrigger value="fiscal" className="min-w-28">Fiscal</TabsTrigger>}
                        {!isGerente && <TabsTrigger value="ecf" className="min-w-24">e-CF</TabsTrigger>}
                        {!isGerente && <TabsTrigger value="users" className="min-w-24">Usuarios</TabsTrigger>}
                    </TabsList>
                </div>

                <TabsContent value="inventory" className="space-y-4">
                    <ProductTypesSettings initialTypes={productTypes} initialCatalog={productTypeCatalog} />
                    <UnitTypesSettings initialTypes={unitTypes} />
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4">
                    <ExpenseCategoriesSettings initialCategories={expenseCategories} />
                </TabsContent>

                {!isGerente && (
                    <>
                        <TabsContent value="fiscal" className="space-y-4">
                            <NCFSettings initialSequences={ncfSequences} />
                        </TabsContent>

                        <TabsContent value="ecf" className="space-y-4">
                            <EcfSettings />
                            <ContingencyPanel />
                        </TabsContent>

                        <TabsContent value="users" className="space-y-4">
                            <UsersSettings initialUsers={users} />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
}
