'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  FolderOpen,
  Folder,
  Upload,
  Filter,
  FileText,
  X,
  AlertCircle,
  Loader2,
  Download,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  useDocuments,
  useDocument,
  useCreateDocument,
} from '@/lib/hooks/admin/use-documents';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DocumentManagerPage() {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [academicYearFilter, setAcademicYearFilter] = useState('');

  // Modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    sub_category: '',
    file_url: '',
    file_name: '',
    description: '',
    tags: '',
    access_level: 'admin_only',
    academic_year: '',
  });

  // API calls
  const {
    data: documentsData,
    isLoading: documentsLoading,
    error: documentsError,
  } = useDocuments({
    search: searchQuery || undefined,
    category: activeCategory || undefined,
    academic_year: academicYearFilter || undefined,
    is_archived: false,
    page_size: 100,
  });

  const {
    data: selectedDocument,
    isLoading: documentLoading,
  } = useDocument(selectedDocumentId!, { enabled: !!selectedDocumentId });

  const createMutation = useCreateDocument();

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const documents = useMemo(() => documentsData?.data || [], [documentsData?.data]);

  // Extract unique categories for folder tree
  const categories = useMemo(() => {
    const categoryMap = new Map<
      string,
      { count: number; subCategories: Set<string> }
    >();

    documents.forEach((doc) => {
      if (doc.category) {
        if (!categoryMap.has(doc.category)) {
          categoryMap.set(doc.category, {
            count: 0,
            subCategories: new Set(),
          });
        }
        const category = categoryMap.get(doc.category)!;
        category.count++;
        if (doc.sub_category) {
          category.subCategories.add(doc.sub_category);
        }
      }
    });

    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      subCategories: Array.from(data.subCategories),
    }));
  }, [documents]);

  // Filter documents by selected category
  const filteredDocuments = useMemo(() => {
    if (!activeCategory) return documents;
    return documents.filter((doc) => doc.category === activeCategory);
  }, [documents, activeCategory]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleUploadClick = () => {
    setFormData({
      title: '',
      category: '',
      sub_category: '',
      file_url: '',
      file_name: '',
      description: '',
      tags: '',
      access_level: 'admin_only',
      academic_year: '',
    });
    setShowUploadModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.file_url) {
      alert('Title and File URL are required');
      return;
    }

    try {
      const tags = formData.tags
        ? formData.tags.split(',').map((t) => t.trim())
        : [];

      await createMutation.mutateAsync({
        title: formData.title,
        category: formData.category || null,
        sub_category: formData.sub_category || null,
        file_url: formData.file_url,
        file_name: formData.file_name || null,
        description: formData.description || null,
        tags: tags.length > 0 ? tags : null,
        access_level: formData.access_level,
        academic_year: formData.academic_year || null,
      });

      setShowUploadModal(false);
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert('Failed to upload document. Please try again.');
    }
  };

  const handleViewVersionHistory = (documentId: string) => {
    setSelectedDocumentId(documentId);
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileText className="h-5 w-5" />;
    if (mimeType.includes('pdf')) {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-red-500/10">
          <FileText className="h-5 w-5 text-red-500" />
        </div>
      );
    }
    if (
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      mimeType.includes('msword')
    ) {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/10">
          <FileText className="h-5 w-5 text-blue-500" />
        </div>
      );
    }
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-500/10">
        <FileText className="h-5 w-5 text-gray-500" />
      </div>
    );
  };

  const getAccessBadge = (accessLevel: string) => {
    if (accessLevel === 'public') {
      return (
        <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          Public
        </Badge>
      );
    }
    return (
      <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
        Admin-Only
      </Badge>
    );
  };

  const formatFileSize = (size: number | null) => {
    if (!size) return 'Unknown';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Build version history chain
  const versionHistory = useMemo(() => {
    if (!selectedDocument) return [];

    const history: typeof documents = [selectedDocument];
    let current = selectedDocument;

    // Find all parent documents
    while (current.parent_document_id) {
      const parent = documents.find((d) => d.id === current.parent_document_id);
      if (!parent) break;
      history.push(parent);
      current = parent;
    }

    // Find all child documents
    const findChildren = (docId: string): typeof documents => {
      const children = documents.filter((d) => d.parent_document_id === docId);
      return [
        ...children,
        ...children.flatMap((child) => findChildren(child.id)),
      ];
    };

    const children = findChildren(selectedDocument.id);
    history.unshift(...children.reverse());

    return history;
  }, [selectedDocument, documents]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (documentsError) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[#0A0A0A]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-sm text-gray-400">
            Failed to load documents data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#0A0A0A]">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#1E1E1E] px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="cursor-pointer hover:text-white">Admin</span>
          <span className="text-gray-600">/</span>
          <span className="font-semibold text-white">Document Manager</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden w-96 md:block">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents, file contents..."
              className="w-full rounded-lg border border-[#1E1E1E] bg-[#141414] py-2 pl-10 pr-3 text-sm text-gray-300 placeholder-gray-500 outline-none focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <Input
            type="text"
            value={academicYearFilter}
            onChange={(e) => setAcademicYearFilter(e.target.value)}
            placeholder="Academic Year"
            className="hidden w-32 border-[#1E1E1E] bg-[#141414] text-sm text-white md:block"
          />
          <Button onClick={handleUploadClick} size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        </div>
      </div>

      {/* 2-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ---- Left sidebar: File Browser ---- */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-[#1E1E1E] bg-[#141414]">
          <div className="border-b border-[#1E1E1E] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Categories
            </h2>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {/* All Documents */}
            <button
              onClick={() => setActiveCategory(null)}
              className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                activeCategory === null
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'text-gray-400 hover:bg-[#262626] hover:text-white'
              }`}
            >
              {activeCategory === null ? (
                <FolderOpen className="h-5 w-5" />
              ) : (
                <Folder className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">All Documents</span>
              <span
                className={`ml-auto text-xs ${
                  activeCategory === null ? 'opacity-60' : 'text-gray-600'
                }`}
              >
                {documents.length}
              </span>
            </button>

            {/* Category folders */}
            {documentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              categories.map((category) => (
                <div key={category.name}>
                  <button
                    onClick={() => setActiveCategory(category.name)}
                    className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                      activeCategory === category.name
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'text-gray-400 hover:bg-[#262626] hover:text-white'
                    }`}
                  >
                    {activeCategory === category.name ? (
                      <FolderOpen className="h-5 w-5" />
                    ) : (
                      <Folder className="h-5 w-5" />
                    )}
                    <span className="text-sm font-medium">{category.name}</span>
                    <span
                      className={`ml-auto text-xs ${
                        activeCategory === category.name
                          ? 'opacity-60'
                          : 'text-gray-600'
                      }`}
                    >
                      {category.count}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ---- Center: Document Table ---- */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#111111]">
          {/* Folder header */}
          <div className="flex items-center justify-between border-b border-[#1E1E1E] p-6">
            <div>
              <h1 className="text-xl font-bold text-white">
                {activeCategory || 'All Documents'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Found {filteredDocuments.length} document
                {filteredDocuments.length !== 1 ? 's' : ''}
                {activeCategory && ' in this category'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-[#1E1E1E] bg-[#141414] p-2 text-gray-400 hover:bg-[#262626] hover:text-white"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory(null);
                  setAcademicYearFilter('');
                }}
              >
                <Filter className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto p-6">
            {documentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No documents found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1E1E1E] hover:bg-transparent">
                    <TableHead className="w-12" />
                    <TableHead className="text-xs font-semibold uppercase text-gray-400">
                      Document Name
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-gray-400">
                      Category
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-gray-400">
                      Size
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-gray-400">
                      Access
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-gray-400">
                      Version
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-gray-400">
                      Last Modified
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase text-gray-400">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="border-[#1E1E1E] hover:bg-[#1A1A1A]"
                    >
                      <TableCell>{getFileIcon(doc.mime_type)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {doc.title}
                          </p>
                          {doc.file_name && (
                            <p className="text-xs text-gray-500">
                              {doc.file_name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {doc.category || '—'}
                        {doc.sub_category && (
                          <span className="text-gray-600">
                            {' '}
                            / {doc.sub_category}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {formatFileSize(doc.file_size)}
                      </TableCell>
                      <TableCell>{getAccessBadge(doc.access_level)}</TableCell>
                      <TableCell className="text-sm text-gray-400">
                        v{doc.version}
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {new Date(doc.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-emerald-500/10 hover:text-emerald-500"
                            onClick={() => window.open(doc.file_url, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-blue-500/10 hover:text-blue-500"
                            onClick={() => handleViewVersionHistory(doc.id)}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {!documentsLoading && documentsData && (
            <div className="flex items-center justify-between border-t border-[#1E1E1E] px-6 py-3 text-xs text-gray-400">
              <span>
                Showing 1-{documentsData.data.length} of {documentsData.total}{' '}
                documents
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={documentsData.page === 1}
                  className="text-xs"
                >
                  Previous
                </Button>
                <Button size="sm" className="px-3 text-xs">
                  {documentsData.page}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={documentsData.page >= documentsData.total_pages}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#1E1E1E] bg-[#141414] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Upload Document
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="border-[#1E1E1E] bg-[#262626] text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., policies, compliance"
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Sub-Category</Label>
                  <Input
                    value={formData.sub_category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sub_category: e.target.value,
                      })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300">
                  File URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.file_url}
                  onChange={(e) =>
                    setFormData({ ...formData, file_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="border-[#1E1E1E] bg-[#262626] text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  File upload to R2 is TODO. For now, paste a direct URL.
                </p>
              </div>

              <div>
                <Label className="text-gray-300">File Name</Label>
                <Input
                  value={formData.file_name}
                  onChange={(e) =>
                    setFormData({ ...formData, file_name: e.target.value })
                  }
                  placeholder="document.pdf"
                  className="border-[#1E1E1E] bg-[#262626] text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300">Description</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] p-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Tags</Label>
                  <Input
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                    placeholder="tag1, tag2, tag3"
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Comma-separated tags
                  </p>
                </div>
                <div>
                  <Label className="text-gray-300">Academic Year</Label>
                  <Input
                    value={formData.academic_year}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        academic_year: e.target.value,
                      })
                    }
                    placeholder="2025-26"
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Access Level</Label>
                <select
                  value={formData.access_level}
                  onChange={(e) =>
                    setFormData({ ...formData, access_level: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] p-2 text-white outline-none"
                >
                  <option value="admin_only">Admin-Only</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={createMutation.isPending}
                className="flex-1 rounded border border-[#1E1E1E] bg-[#262626] py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#262626]/80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  !formData.title ||
                  !formData.file_url
                }
                className="flex flex-1 items-center justify-center gap-2 rounded bg-emerald-500 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {selectedDocumentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[#1E1E1E] bg-[#141414] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Version History
              </h2>
              <button
                onClick={() => setSelectedDocumentId(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {documentLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : versionHistory.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No version history available
              </div>
            ) : (
              <div className="space-y-3">
                {versionHistory.map((doc, index) => (
                  <div
                    key={doc.id}
                    className={`rounded-lg border p-4 ${
                      doc.id === selectedDocumentId
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-[#1E1E1E] bg-[#262626]/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {doc.title}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            v{doc.version}
                          </Badge>
                          {doc.id === selectedDocumentId && (
                            <Badge className="bg-emerald-500/10 text-emerald-400">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Uploaded on {new Date(doc.created_at).toLocaleString()}
                        </p>
                        {doc.uploaded_by_name && (
                          <p className="text-xs text-gray-500">
                            by {doc.uploaded_by_name}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(doc.file_url, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    {doc.parent_document_id && index > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        Updated from v{versionHistory[index - 1]?.version}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
