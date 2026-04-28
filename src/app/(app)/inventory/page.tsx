"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Package, AlertTriangle, Filter, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { getProducts } from '@/lib/actions/inventoryActions';
import { Product, ProductType } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateProductDialog } from '@/components/inventory/create-product-dialog';
import { EditProductDialog } from '@/components/inventory/edit-product-dialog';
import { deleteProductAction } from '@/lib/actions/inventoryActions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventoryHistory } from '@/components/inventory/inventory-history';
import { AddStockDialog } from '@/components/inventory/add-stock-dialog';

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<ProductType | 'Todos' | 'Producto Terminado'>('Todos');
    const { toast } = useToast();
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
    const [addStockProduct, setAddStockProduct] = useState<Product | null>(null);
    const [isAddStockOpen, setIsAddStockOpen] = useState(false);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const result = await getProducts(page, 20, searchTerm, typeFilter);
            setProducts(result.products);
            setTotalPages(result.totalPages);
            setTotalProducts(result.total);
        } catch (error) {
            console.error("Failed to fetch products", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search to prevent excessive API calls
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, searchTerm, typeFilter]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setPage(1); // Reset to first page on search
    };

    const handleTypeChange = (value: string) => {
        setTypeFilter(value as ProductType | 'Todos' | 'Producto Terminado');
        setPage(1); // Reset to first page on filter
    };

    const handleDelete = async () => {
        if (!deleteProduct) return;

        const result = await deleteProductAction(deleteProduct.id);
        if (result.success) {
            toast({ title: "Producto eliminado", description: "El producto ha sido eliminado correctamente." });
            fetchProducts();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setDeleteProduct(null);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsEditOpen(true);
    };

    const handleAddStock = (product: Product) => {
        setAddStockProduct(product);
        setIsAddStockOpen(true);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Inventario</h1>
                    <p className="text-muted-foreground mt-1">Gestione sus productos y monitoree el stock.</p>
                </div>
                <CreateProductDialog onProductCreated={fetchProducts} />
            </div>

            <Tabs defaultValue="list" className="w-full">
                <TabsList>
                    <TabsTrigger value="list">Inventario Actual</TabsTrigger>
                    <TabsTrigger value="history">Historial de Movimientos</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-6">
                    <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                                <div className="relative w-full sm:max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nombre o SKU..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className="pl-10"
                                    />
                                </div>
                                <Select value={typeFilter} onValueChange={handleTypeChange}>
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                        <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="Categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Todos">Todos</SelectItem>
                                        <SelectItem value="Producto Terminado">Producto Terminado</SelectItem>
                                        <SelectItem value="Materia Prima">Materia Prima</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>SKU</TableHead>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead>Fecha Creación</TableHead>
                                            <TableHead className="text-right">Stock</TableHead>
                                            <TableHead className="text-right">Precio</TableHead>
                                            <TableHead className="text-right">Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={9} className="h-24 text-center">
                                                    <div className="flex justify-center items-center">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : products.length > 0 ? (
                                            products.map((product) => (
                                                <TableRow key={product.id} className="hover:bg-muted/30">
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{product.sku}</TableCell>
                                                    <TableCell className="font-medium">{product.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {product.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {product.createdAt ? format(new Date(product.createdAt), 'dd MMM yyyy', { locale: es }) : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {product.stock} {product.unit}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {product.price > 0 ? `$${product.price.toFixed(2)}` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {product.stock <= product.minStock ? (
                                                            <Badge variant="destructive" className="flex items-center justify-end w-fit ml-auto gap-1">
                                                                <AlertTriangle className="h-3 w-3" /> Bajo
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                                                                Normal
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="sm">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => handleAddStock(product)}>
                                                                    <PlusCircle className="h-4 w-4 mr-2 text-green-600" />
                                                                    Reabastecer
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleEdit(product)}>
                                                                    <Edit className="h-4 w-4 mr-2" />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => setDeleteProduct(product)}
                                                                    className="text-destructive focus:text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Eliminar
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={9} className="h-32 text-center">
                                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                        <Package className="h-10 w-10 mb-2 opacity-20" />
                                                        <p>No se encontraron productos.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-end space-x-2 py-4">
                                <div className="flex-1 text-sm text-muted-foreground">
                                    Página {page} de {totalPages}
                                </div>
                                <div className="space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || isLoading}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages || isLoading}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <InventoryHistory />
                </TabsContent>
            </Tabs>

            <EditProductDialog
                product={editingProduct}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={fetchProducts}
            />

            <AddStockDialog
                product={addStockProduct}
                open={isAddStockOpen}
                onOpenChange={setIsAddStockOpen}
                onSuccess={fetchProducts}
            />

            <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Producto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Está seguro que desea eliminar el producto <strong>{deleteProduct?.name}</strong>?
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
