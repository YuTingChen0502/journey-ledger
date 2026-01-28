import { useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table'
import { useRxData, useRxCollection } from 'rxdb-hooks'
import type { TripEventDocType } from '@/db/schema'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { safeFormatTime } from '@/lib/dateUtils'
import { toast } from 'sonner' // Assuming sonner is available (used in ImportModal)

export function TripTable({ onEdit }: { onEdit?: (id: string) => void }) {
    const collection = useRxCollection<TripEventDocType>('tripevents');
    const { result: data, isFetching } = useRxData<TripEventDocType>(
        'tripevents',
        collection => collection.find({
            selector: {
                is_deleted: { $eq: false }
            },
            sort: [{ updated_at: 'desc' }]
        })
    )

    const [sorting, setSorting] = useState<SortingState>([])

    // Batch Delete Safety State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteAll = async () => {
        if (deleteConfirmText !== 'DELETE') return;

        setIsDeleting(true);
        try {
            // Find all non-deleted events for this view (implicit trip_id usually, but here we scan all loaded)
            // Ideally we filter by trip_id, but the current query doesn't show trip_id prop passed to TripTable.
            // Assuming the current collection context or data list is sufficient.
            // Safe approach: Remove IDs present in the current data view.

            const idsToDelete = data.map(d => d.id);
            if (idsToDelete.length === 0) return;

            // Proper RxDB Batch Pattern: Find docs -> Update
            // Or simpler: collection.find({ selector: { id: { $in: idsToDelete } } }).update({ $set: { is_deleted: true } })

            const docs = await collection?.find({
                selector: {
                    id: { $in: idsToDelete }
                }
            }).exec();

            if (docs && docs.length > 0) {
                await Promise.all(docs.map(doc => doc.incrementalPatch({ is_deleted: true, updated_at: Date.now() })));
                toast.success(`Deleted ${docs.length} events.`);
            }

            setDeleteDialogOpen(false);
            setDeleteConfirmText('');
        } catch (err: any) {
            console.error("Batch Delete Error", err);
            toast.error("Failed to delete events.");
        } finally {
            setIsDeleting(false);
        }
    };

    const columns: ColumnDef<TripEventDocType>[] = [
        {
            accessorKey: 'title',
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        Title
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
        },
        {
            accessorKey: 'is_floating',
            header: 'Type',
            cell: ({ row }) => {
                return row.getValue('is_floating') ?
                    <Badge variant="outline">Floating</Badge> :
                    <Badge>Scheduled</Badge>
            }
        },
        {
            accessorKey: 'start_time',
            header: 'Start Time',
            cell: ({ row }) => {
                const val = row.getValue('start_time') as string;
                return safeFormatTime(val);
            }
        },
        {
            accessorKey: 'location',
            header: 'Location',
        },
        {
            id: 'actions',
            header: ({ table }) => {
                // Check if we have data to delete
                const hasData = table.getFilteredRowModel().rows.length > 0;
                return hasData ? (
                    <div className="text-right">
                        <span
                            className="text-xs text-muted-foreground cursor-pointer hover:text-destructive hover:underline transition-colors"
                            onClick={() => setDeleteDialogOpen(true)}
                        >
                            Delete All
                        </span>
                    </div>
                ) : null;
            },
            cell: ({ row }) => {
                const item = row.original;

                const handleDelete = async () => {
                    if (confirm('Delete this event?')) {
                        const doc = await collection?.findOne(item.id).exec();
                        if (doc) {
                            await doc.incrementalPatch({ is_deleted: true, updated_at: Date.now() });
                        }
                    }
                }

                return (
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => onEdit?.(item.id)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={handleDelete}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        },
    ]

    const table = useReactTable({
        data: data || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        state: {
            sorting,
        },
    })

    if (isFetching) return <div>Loading...</div>

    return (
        <div className="space-y-4">
            {/* Toolbar Removed - Delete All moved to Header */}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Safety Delete Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Delete All Events?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone immediately. It will mark <b>{data.length} events</b> as deleted.
                            <br /><br />
                            Please type <b>DELETE</b> to confirm.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-2">
                        <Label htmlFor="confirm-delete" className="sr-only">Confirmation</Label>
                        <Input
                            id="confirm-delete"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Type DELETE to confirm"
                            className="border-destructive/50 focus-visible:ring-destructive"
                            autoComplete="off"
                        />
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting} onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e: React.MouseEvent) => {
                                e.preventDefault(); // Handle async
                                handleDeleteAll();
                            }}
                            disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
