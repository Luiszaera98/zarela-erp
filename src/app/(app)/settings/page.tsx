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

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const unitTypes = await getUnitTypes();
    const productTypes = await getProductTypes();
    const productTypeCatalog = await getProductTypeCatalog();
    const expenseCategories = await getExpenseCategories();
    const ncfSequences = await getNCFSequences();
    const users = await getUsers();

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-10">
            <div>
                <h1 className="text-4xl font-bold tracking-tight">Configuración</h1>
                <p className="text-muted-foreground mt-1">Administre las preferencias generales del sistema.</p>
            </div>

            <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-8">
                    <TabsTrigger value="inventory">Inventario</TabsTrigger>
                    <TabsTrigger value="expenses">Gastos</TabsTrigger>
                    <TabsTrigger value="fiscal">Fiscal (NCF)</TabsTrigger>
                    <TabsTrigger value="ecf">e-CF</TabsTrigger>
                    <TabsTrigger value="users">Usuarios</TabsTrigger>
                </TabsList>

                <TabsContent value="inventory" className="space-y-4">
                    <ProductTypesSettings initialTypes={productTypes} initialCatalog={productTypeCatalog} />
                    <UnitTypesSettings initialTypes={unitTypes} />
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4">
                    <ExpenseCategoriesSettings initialCategories={expenseCategories} />
                </TabsContent>

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
            </Tabs>
        </div>
    );
}
