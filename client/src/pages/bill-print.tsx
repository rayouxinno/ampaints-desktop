<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bill Print - ALI MUHAMMAD Paints</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/lucide/1.28.0/font/lucide.css">
    <style>
        @media print {
            @page {
                margin: 0;
                padding: 0;
                size: auto;
            }
            body * {
                visibility: hidden;
                margin: 0 !important;
                padding: 0 !important;
            }
            .print-content, .print-content * {
                visibility: visible;
            }
            .print-content {
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: 1px solid #000 !important;
            }
            .no-print {
                display: none !important;
            }
            body {
                margin: 0;
                padding: 0;
                background: white !important;
                color: black !important;
                font-family: 'Courier New', monospace !important;
                font-weight: bold !important;
                line-height: 1 !important;
            }
            * {
                color: black !important;
                background: white !important;
                border-color: black !important;
            }
            .space-y-4 > * + * {
                margin-top: 0.5rem !important;
            }
            .space-y-2 > * + * {
                margin-top: 0.25rem !important;
            }
        }
        
        .hover-elevate {
            transition: all 0.2s ease;
        }
        .hover-elevate:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
        }
        
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    </style>
</head>
<body class="bg-gray-100 p-4">
    <div id="app" class="p-6">
        <!-- Content will be rendered here by JavaScript -->
    </div>

    <script>
        // Sample data for demonstration
        const sampleSale = {
            id: 'sale-001',
            shopName: 'ALI MUHAMMAD Paints',
            shopAddress: 'Basti Malook (Multan). 03008683395',
            customerName: 'Ahmed Khan',
            customerPhone: '0300-1234567',
            createdAt: new Date().toISOString(),
            totalAmount: '2500',
            amountPaid: '2000',
            paymentStatus: 'partial',
            saleItems: [
                {
                    id: 'item-1',
                    color: {
                        colorName: 'Royal Blue',
                        colorCode: 'BL-001',
                        variant: {
                            packingSize: '1L'
                        }
                    },
                    quantity: 2,
                    rate: '500',
                    subtotal: '1000'
                },
                {
                    id: 'item-2',
                    color: {
                        colorName: 'Sunshine Yellow',
                        colorCode: 'YL-005',
                        variant: {
                            packingSize: '500ml'
                        }
                    },
                    quantity: 3,
                    rate: '300',
                    subtotal: '900'
                },
                {
                    id: 'item-3',
                    color: {
                        colorName: 'Fire Red',
                        colorCode: 'RD-012',
                        variant: {
                            packingSize: '2L'
                        }
                    },
                    quantity: 2,
                    rate: '300',
                    subtotal: '600'
                }
            ]
        };

        const sampleColors = [
            {
                id: 'color-1',
                colorName: 'Royal Blue',
                colorCode: 'BL-001',
                stockQuantity: 15,
                variant: {
                    packingSize: '1L',
                    rate: '500',
                    product: {
                        company: 'Berger',
                        productName: 'Weathercoat'
                    }
                }
            },
            {
                id: 'color-2',
                colorName: 'Sunshine Yellow',
                colorCode: 'YL-005',
                stockQuantity: 8,
                variant: {
                    packingSize: '500ml',
                    rate: '300',
                    product: {
                        company: 'Berger',
                        productName: 'Weathercoat'
                    }
                }
            },
            {
                id: 'color-3',
                colorName: 'Fire Red',
                colorCode: 'RD-012',
                stockQuantity: 12,
                variant: {
                    packingSize: '2L',
                    rate: '600',
                    product: {
                        company: 'Berger',
                        productName: 'Weathercoat'
                    }
                }
            },
            {
                id: 'color-4',
                colorName: 'Forest Green',
                colorCode: 'GR-008',
                stockQuantity: 5,
                variant: {
                    packingSize: '1L',
                    rate: '550',
                    product: {
                        company: 'Diamond',
                        productName: 'Paints'
                    }
                }
            }
        ];

        // Format date to dd-mm-yyyy
        function formatDate(dateString) {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        }

        // Bill Print Component
        function BillPrint() {
            const [sale, setSale] = React.useState(sampleSale);
            const [colors, setColors] = React.useState(sampleColors);
            const [isLoading, setIsLoading] = React.useState(false);
            const [editMode, setEditMode] = React.useState(false);
            const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
            const [addItemDialogOpen, setAddItemDialogOpen] = React.useState(false);
            const [selectedColor, setSelectedColor] = React.useState(null);
            const [quantity, setQuantity] = React.useState("1");
            const [searchQuery, setSearchQuery] = React.useState("");
            const [toast, setToast] = React.useState({ show: false, message: '', type: 'default' });

            // Show toast message
            const showToast = (message, type = 'default') => {
                setToast({ show: true, message, type });
                setTimeout(() => {
                    setToast({ show: false, message: '', type: 'default' });
                }, 3000);
            };

            // Filter colors based on search query
            const filteredColors = React.useMemo(() => {
                if (!searchQuery) return colors;

                const query = searchQuery.toLowerCase();
                
                return colors
                    .map((color) => {
                        let score = 0;
                        
                        // Exact color code match (highest priority)
                        if (color.colorCode.toLowerCase() === query) {
                            score += 1000;
                        } else if (color.colorCode.toLowerCase().startsWith(query)) {
                            score += 500;
                        } else if (color.colorCode.toLowerCase().includes(query)) {
                            score += 100;
                        }
                        
                        // Color name matching
                        if (color.colorName.toLowerCase() === query) {
                            score += 200;
                        } else if (color.colorName.toLowerCase().includes(query)) {
                            score += 50;
                        }
                        
                        // Company and product matching
                        if (color.variant.product.company.toLowerCase().includes(query)) {
                            score += 30;
                        }
                        if (color.variant.product.productName.toLowerCase().includes(query)) {
                            score += 30;
                        }
                        
                        // Packing size matching
                        if (color.variant.packingSize.toLowerCase().includes(query)) {
                            score += 20;
                        }
                        
                        return { color, score };
                    })
                    .filter(({ score }) => score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map(({ color }) => color);
            }, [colors, searchQuery]);

            const isPaid = sale.paymentStatus === "paid";
            const isPartial = sale.paymentStatus === "partial";
            const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);

            const handlePrint = () => {
                window.print();
            };

            const handleDeleteBill = () => {
                // In a real app, this would make an API call
                showToast("Bill deleted successfully", "success");
                setDeleteDialogOpen(false);
                // Redirect to POS page
                setTimeout(() => {
                    window.location.href = "#";
                }, 1000);
            };

            const handleRemoveItem = (itemId) => {
                // In a real app, this would make an API call
                const updatedItems = sale.saleItems.filter(item => item.id !== itemId);
                const newTotal = updatedItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
                
                setSale({
                    ...sale,
                    saleItems: updatedItems,
                    totalAmount: newTotal.toString()
                });
                
                showToast("Item removed from bill", "success");
            };

            const handleUpdateQuantity = (itemId, newQuantity) => {
                if (newQuantity < 1) {
                    showToast("Quantity must be at least 1", "error");
                    return;
                }
                
                // In a real app, this would make an API call
                const updatedItems = sale.saleItems.map(item => {
                    if (item.id === itemId) {
                        const newSubtotal = parseFloat(item.rate) * newQuantity;
                        return {
                            ...item,
                            quantity: newQuantity,
                            subtotal: newSubtotal.toString()
                        };
                    }
                    return item;
                });
                
                const newTotal = updatedItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
                
                setSale({
                    ...sale,
                    saleItems: updatedItems,
                    totalAmount: newTotal.toString()
                });
                
                showToast("Quantity updated", "success");
            };

            const handleAddItem = () => {
                if (!selectedColor) {
                    showToast("Please select a product", "error");
                    return;
                }

                const qty = parseInt(quantity);
                if (qty <= 0) {
                    showToast("Quantity must be positive", "error");
                    return;
                }

                if (qty > selectedColor.stockQuantity) {
                    showToast("Not enough stock available", "error");
                    return;
                }

                // In a real app, this would make an API call
                const newItem = {
                    id: `item-${Date.now()}`,
                    color: selectedColor,
                    quantity: qty,
                    rate: selectedColor.variant.rate,
                    subtotal: (parseFloat(selectedColor.variant.rate) * qty).toString()
                };

                const updatedItems = [...sale.saleItems, newItem];
                const newTotal = updatedItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
                
                setSale({
                    ...sale,
                    saleItems: updatedItems,
                    totalAmount: newTotal.toString()
                });

                showToast("Product added to bill", "success");
                setAddItemDialogOpen(false);
                setSelectedColor(null);
                setQuantity("1");
                setSearchQuery("");
            };

            // Loading state
            if (isLoading) {
                return React.createElement(
                    'div',
                    { className: 'p-6' },
                    React.createElement('div', { 
                        className: 'skeleton h-96 w-full max-w-2xl mx-auto rounded-lg' 
                    })
                );
            }

            if (!sale) {
                return React.createElement(
                    'div',
                    { className: 'p-6 flex items-center justify-center min-h-screen' },
                    React.createElement(
                        'div',
                        { className: 'max-w-md border border-gray-300 rounded-lg overflow-hidden shadow-sm' },
                        React.createElement(
                            'div',
                            { className: 'p-6 text-center' },
                            React.createElement('p', { className: 'text-gray-600' }, 'Sale not found'),
                            React.createElement(
                                'a',
                                { href: '#', className: 'mt-4 inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600' },
                                React.createElement('i', { className: 'mr-2', 'data-lucide': 'arrow-left' }),
                                'Back to POS'
                            )
                        )
                    )
                );
            }

            return React.createElement(
                'div',
                null,
                // Toast Notification
                toast.show && React.createElement(
                    'div',
                    { 
                        className: `fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${
                            toast.type === 'error' ? 'bg-red-500 text-white' : 
                            toast.type === 'success' ? 'bg-green-500 text-white' : 
                            'bg-blue-500 text-white'
                        }` 
                    },
                    toast.message
                ),
                
                // Main Content
                React.createElement(
                    'div',
                    { className: 'max-w-2xl mx-auto space-y-4' },
                    // Header with buttons
                    React.createElement(
                        'div',
                        { className: 'flex items-center justify-between no-print' },
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement(
                                'a',
                                { href: '#' },
                                React.createElement(
                                    'button',
                                    { 
                                        className: 'flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50',
                                        'data-testid': 'button-back'
                                    },
                                    React.createElement('i', { className: 'mr-2', 'data-lucide': 'arrow-left' }),
                                    'Back'
                                )
                            ),
                            !isPaid && React.createElement(
                                React.Fragment,
                                null,
                                React.createElement(
                                    'button',
                                    { 
                                        className: `flex items-center px-4 py-2 rounded-md ${
                                            editMode ? 'bg-blue-500 text-white' : 'border border-gray-300 hover:bg-gray-50'
                                        }`,
                                        onClick: () => setEditMode(!editMode),
                                        'data-testid': 'button-edit-mode'
                                    },
                                    React.createElement('i', { className: 'mr-2', 'data-lucide': 'edit' }),
                                    editMode ? 'Done Editing' : 'Edit Bill'
                                ),
                                React.createElement(
                                    'button',
                                    { 
                                        className: 'flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50',
                                        onClick: () => setAddItemDialogOpen(true),
                                        'data-testid': 'button-add-item'
                                    },
                                    React.createElement('i', { className: 'mr-2', 'data-lucide': 'plus' }),
                                    'Add Item'
                                )
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'flex items-center gap-2' },
                            React.createElement(
                                'button',
                                { 
                                    className: 'flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                                    onClick: () => setDeleteDialogOpen(true),
                                    'data-testid': 'button-delete-bill'
                                },
                                React.createElement('i', { className: 'mr-2', 'data-lucide': 'trash-2' }),
                                'Delete Bill'
                            ),
                            React.createElement(
                                'button',
                                { 
                                    className: 'flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                                    onClick: handlePrint,
                                    'data-testid': 'button-print'
                                },
                                React.createElement('i', { className: 'mr-2', 'data-lucide': 'printer' }),
                                'Print Bill'
                            )
                        )
                    ),
                    
                    // Bill Receipt
                    React.createElement(
                        'div',
                        { 
                            className: 'border border-gray-300 rounded-lg overflow-hidden shadow-sm print:shadow-none print:border-0 print-content',
                            'data-testid': 'bill-receipt'
                        },
                        React.createElement(
                            'div',
                            { className: 'p-4 print:p-2 space-y-4 print:space-y-2' },
                            // Header
                            React.createElement(
                                'div',
                                { className: 'text-center border-b border-black pb-2 print:pb-1' },
                                React.createElement(
                                    'h1',
                                    { className: 'text-xl print:text-lg font-bold leading-tight' },
                                    sale.shopName || 'ALI MUHAMMAD Paints'
                                ),
                                React.createElement(
                                    'p',
                                    { className: 'text-xs print:text-xs leading-tight' },
                                    sale.shopAddress || 'Basti Malook (Multan). 03008683395'
                                ),
                                React.createElement(
                                    'p',
                                    { className: 'text-xs print:text-xs mt-1' },
                                    `Invoice #${sale.id.slice(0, 8).toUpperCase()}`
                                )
                            ),
                            
                            // Customer Info
                            React.createElement(
                                'div',
                                { className: 'grid grid-cols-2 gap-2 text-sm print:text-xs' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('p', { className: 'font-medium mb-1' }, 'Customer:'),
                                    React.createElement(
                                        'p', 
                                        { className: 'font-bold', 'data-testid': 'text-customer-name' },
                                        sale.customerName
                                    )
                                ),
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('p', { className: 'font-medium mb-1' }, 'Phone:'),
                                    React.createElement(
                                        'p', 
                                        { className: 'font-bold', 'data-testid': 'text-customer-phone' },
                                        sale.customerPhone
                                    )
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'col-span-2' },
                                    React.createElement('p', { className: 'font-medium mb-1' }, 'Date:'),
                                    React.createElement(
                                        'p', 
                                        { className: 'font-bold' },
                                        formatDate(sale.createdAt)
                                    )
                                )
                            ),
                            
                            // Items Table
                            React.createElement(
                                'div',
                                { className: 'border-t border-black pt-2 print:pt-1' },
                                React.createElement(
                                    'div',
                                    { className: 'flex items-center justify-between mb-2 print:mb-1' },
                                    React.createElement('h2', { className: 'font-semibold text-sm print:text-sm' }, 'ITEMS'),
                                    editMode && React.createElement(
                                        'span',
                                        { className: 'no-print text-xs bg-gray-200 px-2 py-1 rounded' },
                                        'Edit Mode'
                                    )
                                ),
                                React.createElement(
                                    'table',
                                    { className: 'w-full text-xs print:text-xs' },
                                    React.createElement(
                                        'thead',
                                        null,
                                        React.createElement(
                                            'tr',
                                            { className: 'border-b border-black text-left' },
                                            React.createElement('th', { className: 'pb-1 font-bold w-8' }, '#'),
                                            React.createElement('th', { className: 'pb-1 font-bold' }, 'Product'),
                                            React.createElement('th', { className: 'pb-1 font-bold text-right w-12' }, 'Qty'),
                                            React.createElement('th', { className: 'pb-1 font-bold text-right w-16' }, 'Rate'),
                                            React.createElement('th', { className: 'pb-1 font-bold text-right w-20' }, 'Amount'),
                                            editMode && React.createElement('th', { className: 'pb-1 font-bold text-right w-12 no-print' }, 'Actions')
                                        )
                                    ),
                                    React.createElement(
                                        'tbody',
                                        null,
                                        sale.saleItems.map((item, index) => 
                                            React.createElement(
                                                'tr',
                                                { 
                                                    key: item.id, 
                                                    className: 'border-b border-gray-300 last:border-0' 
                                                },
                                                React.createElement('td', { className: 'py-1 align-top' }, index + 1),
                                                React.createElement(
                                                    'td',
                                                    { className: 'py-1 align-top' },
                                                    React.createElement(
                                                        'div',
                                                        null,
                                                        React.createElement('p', { className: 'font-medium leading-tight' }, item.color.colorName),
                                                        React.createElement(
                                                            'span',
                                                            { className: 'text-xs border border-gray-400 px-1 py-0 leading-tight rounded' },
                                                            item.color.colorCode
                                                        ),
                                                        React.createElement(
                                                            'p',
                                                            { className: 'text-xs text-gray-600 leading-tight' },
                                                            item.color.variant.packingSize
                                                        )
                                                    )
                                                ),
                                                React.createElement(
                                                    'td',
                                                    { className: 'py-1 text-right align-top' },
                                                    editMode ? 
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center justify-end gap-1 no-print' },
                                                            React.createElement(
                                                                'button',
                                                                {
                                                                    className: 'h-5 w-5 p-0 border border-gray-300 rounded flex items-center justify-center',
                                                                    onClick: () => handleUpdateQuantity(item.id, item.quantity - 1),
                                                                    disabled: item.quantity <= 1
                                                                },
                                                                React.createElement('i', { className: 'h-2 w-2', 'data-lucide': 'minus' })
                                                            ),
                                                            React.createElement('span', { className: 'min-w-6 text-center' }, item.quantity),
                                                            React.createElement(
                                                                'button',
                                                                {
                                                                    className: 'h-5 w-5 p-0 border border-gray-300 rounded flex items-center justify-center',
                                                                    onClick: () => handleUpdateQuantity(item.id, item.quantity + 1)
                                                                },
                                                                React.createElement('i', { className: 'h-2 w-2', 'data-lucide': 'plus' })
                                                            )
                                                        ) : 
                                                        item.quantity
                                                ),
                                                React.createElement(
                                                    'td',
                                                    { className: 'py-1 text-right align-top' },
                                                    `Rs.${Math.round(parseFloat(item.rate))}`
                                                ),
                                                React.createElement(
                                                    'td',
                                                    { 
                                                        className: 'py-1 text-right font-bold align-top',
                                                        'data-testid': `text-item-subtotal-${index}`
                                                    },
                                                    `Rs.${Math.round(parseFloat(item.subtotal))}`
                                                ),
                                                editMode && React.createElement(
                                                    'td',
                                                    { className: 'py-1 text-right align-top no-print' },
                                                    React.createElement(
                                                        'button',
                                                        {
                                                            className: 'h-5 w-5 p-0 bg-red-500 text-white rounded flex items-center justify-center',
                                                            onClick: () => handleRemoveItem(item.id)
                                                        },
                                                        React.createElement('i', { className: 'h-2 w-2', 'data-lucide': 'trash-2' })
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            ),
                            
                            // Totals
                            React.createElement(
                                'div',
                                { className: 'border-t border-black pt-2 print:pt-1 space-y-1' },
                                React.createElement(
                                    'div',
                                    { className: 'flex justify-between text-sm print:text-sm font-bold border-t border-black pt-1' },
                                    React.createElement('span', null, 'TOTAL AMOUNT:'),
                                    React.createElement(
                                        'span', 
                                        { className: '', 'data-testid': 'text-total-amount' },
                                        `Rs.${Math.round(parseFloat(sale.totalAmount))}`
                                    )
                                )
                            ),
                            
                            // Payment Info
                            React.createElement(
                                'div',
                                { className: 'border-t border-black pt-2 print:pt-1 space-y-1' },
                                React.createElement(
                                    'div',
                                    { className: 'flex justify-between text-sm print:text-sm' },
                                    React.createElement('span', { className: 'font-medium' }, 'Amount Paid:'),
                                    React.createElement(
                                        'span', 
                                        { className: 'font-bold', 'data-testid': 'text-amount-paid' },
                                        `Rs.${Math.round(parseFloat(sale.amountPaid))}`
                                    )
                                ),
                                !isPaid && React.createElement(
                                    'div',
                                    { className: 'flex justify-between text-sm print:text-sm font-bold text-red-600' },
                                    React.createElement('span', null, 'Outstanding:'),
                                    React.createElement(
                                        'span', 
                                        { className: '', 'data-testid': 'text-outstanding' },
                                        `Rs.${Math.round(outstanding)}`
                                    )
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'flex justify-between items-center' },
                                    React.createElement('span', { className: 'text-sm print:text-sm font-medium' }, 'Status:'),
                                    React.createElement(
                                        'span',
                                        { 
                                            className: `ml-2 text-xs print:text-xs px-2 py-1 rounded ${
                                                isPaid ? 'bg-green-500 text-white' : 
                                                isPartial ? 'bg-yellow-500 text-white' : 
                                                'border border-gray-400'
                                            }`,
                                            'data-testid': 'badge-payment-status'
                                        },
                                        sale.paymentStatus.toUpperCase()
                                    )
                                )
                            ),
                            
                            // Footer
                            React.createElement(
                                'div',
                                { className: 'border-t border-black pt-2 print:pt-1 text-center' },
                                React.createElement('p', { className: 'text-sm print:text-xs font-bold' }, 'Thank you for your business!'),
                                React.createElement(
                                    'p',
                                    { className: 'text-xs print:text-xs mt-1' },
                                    'For queries: 03008683395'
                                )
                            )
                        )
                    )
                ),
                
                // Delete Confirmation Dialog
                deleteDialogOpen && React.createElement(
                    'div',
                    { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print' },
                    React.createElement(
                        'div',
                        { className: 'bg-white p-6 rounded-lg shadow-lg max-w-md w-full' },
                        React.createElement(
                            'div',
                            { className: 'space-y-4' },
                            React.createElement(
                                'h2',
                                { className: 'text-xl font-bold' },
                                'Delete Bill'
                            ),
                            React.createElement(
                                'p',
                                { className: 'text-gray-600' },
                                'Are you sure you want to delete this bill? This action cannot be undone and will remove all items from this sale.'
                            ),
                            React.createElement(
                                'div',
                                { className: 'flex justify-end gap-2' },
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50',
                                        onClick: () => setDeleteDialogOpen(false)
                                    },
                                    'Cancel'
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                                        onClick: handleDeleteBill,
                                        'data-testid': 'button-confirm-delete'
                                    },
                                    'Delete Bill'
                                )
                            )
                        )
                    )
                ),
                
                // Add Item Dialog
                addItemDialogOpen && React.createElement(
                    'div',
                    { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print' },
                    React.createElement(
                        'div',
                        { className: 'bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto' },
                        React.createElement(
                            'div',
                            { className: 'space-y-4' },
                            React.createElement(
                                'div',
                                null,
                                React.createElement(
                                    'h2',
                                    { className: 'text-xl font-bold' },
                                    'Add Product to Bill'
                                ),
                                React.createElement(
                                    'p',
                                    { className: 'text-gray-600' },
                                    'Search and select a product to add to the bill'
                                )
                            ),
                            // Search
                            React.createElement(
                                'div',
                                { className: 'relative' },
                                React.createElement('input', {
                                    type: 'text',
                                    placeholder: 'Search by color code, name, company, or product...',
                                    value: searchQuery,
                                    onChange: (e) => setSearchQuery(e.target.value),
                                    className: 'w-full p-2 border border-gray-300 rounded-md'
                                })
                            ),
                            // Color Selection
                            React.createElement(
                                'div',
                                { className: 'space-y-2 max-h-60 overflow-y-auto' },
                                filteredColors.length === 0 ? 
                                    React.createElement(
                                        'p',
                                        { className: 'text-center text-gray-600 py-8' },
                                        searchQuery ? 'No colors found matching your search' : 'Start typing to search for colors'
                                    ) :
                                    filteredColors.slice(0, 20).map((color) =>
                                        React.createElement(
                                            'div',
                                            {
                                                key: color.id,
                                                className: `border border-gray-300 rounded-md cursor-pointer hover-elevate ${
                                                    selectedColor?.id === color.id ? 'border-blue-500' : ''
                                                }`,
                                                onClick: () => setSelectedColor(color)
                                            },
                                            React.createElement(
                                                'div',
                                                { className: 'p-3' },
                                                React.createElement(
                                                    'div',
                                                    { className: 'flex items-center justify-between' },
                                                    React.createElement(
                                                        'div',
                                                        { className: 'space-y-1' },
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center gap-2' },
                                                            React.createElement(
                                                                'span',
                                                                { className: 'text-xs border border-gray-400 px-1 py-0 rounded' },
                                                                color.variant.product.company
                                                            ),
                                                            React.createElement(
                                                                'span',
                                                                { className: 'font-medium' },
                                                                color.variant.product.productName
                                                            ),
                                                            React.createElement(
                                                                'span',
                                                                { className: 'text-xs border border-gray-400 px-1 py-0 rounded' },
                                                                color.variant.packingSize
                                                            )
                                                        ),
                                                        React.createElement(
                                                            'div',
                                                            { className: 'flex items-center gap-2 text-sm' },
                                                            React.createElement(
                                                                'span',
                                                                { className: 'text-gray-600' },
                                                                color.colorName
                                                            ),
                                                            React.createElement(
                                                                'span',
                                                                { className: 'text-xs bg-gray-200 px-1 py-0 rounded' },
                                                                color.colorCode
                                                            ),
                                                            React.createElement(
                                                                'span',
                                                                { className: `text-xs px-1 py-0 rounded ${
                                                                    color.stockQuantity > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                                                }` },
                                                                `Stock: ${color.stockQuantity}`
                                                            )
                                                        )
                                                    ),
                                                    React.createElement(
                                                        'div',
                                                        { className: 'text-right' },
                                                        React.createElement(
                                                            'p',
                                                            { className: 'font-medium' },
                                                            `Rs. ${Math.round(parseFloat(color.variant.rate))}`
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                            ),
                            // Quantity Input
                            selectedColor && React.createElement(
                                'div',
                                { className: 'space-y-2' },
                                React.createElement('label', { className: 'block font-medium' }, 'Quantity'),
                                React.createElement('input', {
                                    type: 'number',
                                    min: '1',
                                    max: selectedColor.stockQuantity,
                                    value: quantity,
                                    onChange: (e) => setQuantity(e.target.value),
                                    className: 'w-full p-2 border border-gray-300 rounded-md'
                                }),
                                React.createElement(
                                    'p',
                                    { className: 'text-xs text-gray-600' },
                                    `Available stock: ${selectedColor.stockQuantity} units`
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'p-3 bg-gray-100 rounded-md' },
                                    React.createElement(
                                        'div',
                                        { className: 'flex justify-between' },
                                        React.createElement('span', null, 'Subtotal:'),
                                        React.createElement(
                                            'span',
                                            null,
                                            `Rs. ${Math.round(parseFloat(selectedColor.variant.rate) * parseInt(quantity || "0"))}`
                                        )
                                    )
                                )
                            ),
                            // Dialog Buttons
                            React.createElement(
                                'div',
                                { className: 'flex justify-end gap-2' },
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50',
                                        onClick: () => {
                                            setAddItemDialogOpen(false);
                                            setSelectedColor(null);
                                            setQuantity("1");
                                            setSearchQuery("");
                                        }
                                    },
                                    'Cancel'
                                ),
                                React.createElement(
                                    'button',
                                    {
                                        className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300',
                                        onClick: handleAddItem,
                                        disabled: !selectedColor
                                    },
                                    'Add Product'
                                )
                            )
                        )
                    )
                )
            );
        }

        // Render the app
        const root = ReactDOM.createRoot(document.getElementById('app'));
        root.render(React.createElement(BillPrint));

        // Initialize Lucide icons after render
        setTimeout(() => {
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }, 100);
    </script>
    
    <!-- React and ReactDOM from CDN -->
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <!-- Lucide Icons -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lucide/1.28.0/lucide.min.js"></script>
</body>
</html>
