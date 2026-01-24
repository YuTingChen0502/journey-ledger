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
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ArrowUpDown, Pencil, Trash2 } from 'lucide-react'

export function TripTable() {
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
                return val ? format(new Date(val), 'PP p') : '-';
            }
        },
        {
            accessorKey: 'location',
            header: 'Location',
        },
        {
            id: 'actions',
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
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => alert('Edit ' + item.title)}>
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
    )
}
