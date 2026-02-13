"use client";

import {
  Book,
  BookOpen,
  ArrowLeft,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Globe,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  useLibraryBooks,
  useLibraryJournals,
  useLibraryNMCCompliance,
  useIssueBook,
  useReturnBook,
  useOverdueBooks,
} from "@/lib/hooks/admin/use-library";
import { useDepartments } from "@/lib/hooks/admin/use-departments";
import { LoadingState } from "@/components/admin/loading-state";
import { ErrorState } from "@/components/admin/error-state";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTableWrapper } from "@/components/admin/data-table-wrapper";

export default function LibraryPage() {
  // Search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedJournalType, setSelectedJournalType] = useState<
    "indian" | "foreign"
  >("indian");

  // Issue/Return book modals
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedIssuanceId, setSelectedIssuanceId] = useState<string | null>(
    null
  );
  const [borrowerId, setBorrowerId] = useState("");
  const [borrowerType, setBorrowerType] = useState<string>("student");
  const [dueDate, setDueDate] = useState("");

  // Success/Error banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Queries
  const {
    data: booksData,
    isLoading: booksLoading,
    error: booksError,
  } = useLibraryBooks({
    search: searchTerm || undefined,
    subject: selectedSubject !== "all" ? selectedSubject : undefined,
    department_id:
      selectedDepartment !== "all" ? selectedDepartment : undefined,
    status: selectedStatus !== "all" ? selectedStatus : undefined,
    page_size: 100,
  });

  const {
    data: journalsData,
    isLoading: journalsLoading,
    error: journalsError,
  } = useLibraryJournals({
    journal_type: selectedJournalType,
    subscription_status: "active",
    page_size: 100,
  });

  const {
    data: compliance,
    isLoading: complianceLoading,
    error: complianceError,
  } = useLibraryNMCCompliance();

  const {
    data: overdueBooks,
    isLoading: overdueLoading,
    error: overdueError,
  } = useOverdueBooks();

  const {
    data: departmentsData,
    isLoading: departmentsLoading,
    error: departmentsError,
  } = useDepartments({ page_size: 500 });

  // Mutations
  const issueBookMutation = useIssueBook();
  const returnBookMutation = useReturnBook();

  // Extract data
  const books = booksData?.data ?? [];
  const journals = journalsData?.data ?? [];
  const departments = departmentsData?.data ?? [];

  // Build department map
  const departmentMap = new Map(
    departments.map((d) => [d.id, d.name])
  );

  // Derive unique subjects
  const uniqueSubjects = Array.from(
    new Set(books.map((b) => b.subject).filter(Boolean))
  ).sort();

  // Handle issue book
  const handleIssueBook = async () => {
    if (!selectedBook || !borrowerId || !dueDate) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    try {
      await issueBookMutation.mutateAsync({
        book_id: selectedBook,
        borrower_id: borrowerId,
        borrower_type: borrowerType,
        due_date: dueDate,
      });
      setSuccessMessage("Book issued successfully!");
      setIssueModalOpen(false);
      setSelectedBook(null);
      setBorrowerId("");
      setBorrowerType("student");
      setDueDate("");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to issue book."
      );
    }
  };

  // Handle return book
  const handleReturnBook = async () => {
    if (!selectedIssuanceId) {
      setErrorMessage("No issuance selected.");
      return;
    }

    try {
      const result = await returnBookMutation.mutateAsync({
        issuance_id: selectedIssuanceId,
      });
      const fine = result.fine_amount / 100; // paisa to rupees
      const msg =
        fine > 0
          ? `Book returned successfully! Fine: ₹${fine.toFixed(2)} (${result.overdue_days} days overdue)`
          : "Book returned successfully!";
      setSuccessMessage(msg);
      setReturnModalOpen(false);
      setSelectedIssuanceId(null);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to return book."
      );
    }
  };

  // Loading states
  if (
    booksLoading ||
    journalsLoading ||
    complianceLoading ||
    overdueLoading ||
    departmentsLoading
  ) {
    return <LoadingState />;
  }

  // Error states
  if (
    booksError ||
    journalsError ||
    complianceError ||
    overdueError ||
    departmentsError
  ) {
    return (
      <ErrorState
        error={
          booksError ||
          journalsError ||
          complianceError ||
          overdueError ||
          departmentsError
        }
      />
    );
  }

  // Compliance check
  const booksCompliant =
    compliance && compliance.books.total >= compliance.books.required;
  const indianJournalsCompliant =
    compliance &&
    compliance.indian_journals.total >= compliance.indian_journals.required;
  const foreignJournalsCompliant =
    compliance &&
    compliance.foreign_journals.total >= compliance.foreign_journals.required;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/facilities">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Library Management</h1>
            <p className="text-muted-foreground">
              Manage books, journals, issuances, and NMC compliance
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIssueModalOpen(true)}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Issue Book
          </Button>
          <Button
            variant="outline"
            onClick={() => setReturnModalOpen(true)}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Return Book
          </Button>
        </div>
      </div>

      {/* Success/Error Banners */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100">
          <CheckCircle className="h-5 w-5" />
          <p>{successMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMessage(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-red-900 dark:bg-red-900/20 dark:text-red-100">
          <XCircle className="h-5 w-5" />
          <p>{errorMessage}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* NMC Compliance Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Book className="h-4 w-4" />
              Books
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {compliance?.books.total ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Required: {compliance?.books.required ?? 0}
                </p>
              </div>
              {booksCompliant ? (
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              )}
            </div>
            <Badge
              variant={booksCompliant ? "default" : "destructive"}
              className="mt-2"
            >
              {booksCompliant ? "Compliant" : "Non-Compliant"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Indian Journals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {compliance?.indian_journals.total ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Required: {compliance?.indian_journals.required ?? 0}
                </p>
              </div>
              {indianJournalsCompliant ? (
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              )}
            </div>
            <Badge
              variant={indianJournalsCompliant ? "default" : "destructive"}
              className="mt-2"
            >
              {indianJournalsCompliant ? "Compliant" : "Non-Compliant"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Foreign Journals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {compliance?.foreign_journals.total ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Required: {compliance?.foreign_journals.required ?? 0}
                </p>
              </div>
              {foreignJournalsCompliant ? (
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              )}
            </div>
            <Badge
              variant={foreignJournalsCompliant ? "default" : "destructive"}
              className="mt-2"
            >
              {foreignJournalsCompliant ? "Compliant" : "Non-Compliant"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              E-Library
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {compliance?.e_library ? "Yes" : "No"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Required: Yes
                </p>
              </div>
              {compliance?.e_library ? (
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              )}
            </div>
            <Badge
              variant={compliance?.e_library ? "default" : "destructive"}
              className="mt-2"
            >
              {compliance?.e_library ? "Compliant" : "Non-Compliant"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Book Inventory */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Book Inventory</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search books..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {uniqueSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject!}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedDepartment}
                onValueChange={setSelectedDepartment}
              >
                <SelectTrigger className="w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {books.length === 0 ? (
            <EmptyState
              title="No books found"
              description="Try adjusting your filters."
            />
          ) : (
            <DataTableWrapper>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left text-sm font-medium">
                      Accession #
                    </th>
                    <th className="p-2 text-left text-sm font-medium">Title</th>
                    <th className="p-2 text-left text-sm font-medium">Author</th>
                    <th className="p-2 text-left text-sm font-medium">Subject</th>
                    <th className="p-2 text-left text-sm font-medium">
                      Department
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Available / Total
                    </th>
                    <th className="p-2 text-left text-sm font-medium">Status</th>
                    <th className="p-2 text-left text-sm font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book.id} className="border-b">
                      <td className="p-2 text-sm">
                        {book.accession_number || "—"}
                      </td>
                      <td className="p-2 text-sm font-medium">{book.title}</td>
                      <td className="p-2 text-sm">{book.author || "—"}</td>
                      <td className="p-2 text-sm">{book.subject || "—"}</td>
                      <td className="p-2 text-sm">
                        {book.department_id
                          ? departmentMap.get(book.department_id) || "—"
                          : "—"}
                      </td>
                      <td className="p-2 text-sm">
                        {book.available_copies} / {book.total_copies}
                      </td>
                      <td className="p-2 text-sm">
                        <Badge
                          variant={
                            book.status === "available" ? "default" : "outline"
                          }
                        >
                          {book.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">
                        {book.price
                          ? `₹${(book.price / 100).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableWrapper>
          )}
        </CardContent>
      </Card>

      {/* Journal Subscriptions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Journal Subscriptions</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={
                  selectedJournalType === "indian" ? "default" : "outline"
                }
                onClick={() => setSelectedJournalType("indian")}
              >
                Indian Journals
              </Button>
              <Button
                variant={
                  selectedJournalType === "foreign" ? "default" : "outline"
                }
                onClick={() => setSelectedJournalType("foreign")}
              >
                Foreign Journals
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {journals.length === 0 ? (
            <EmptyState
              title="No journals found"
              description={`No ${selectedJournalType} journals available.`}
            />
          ) : (
            <DataTableWrapper>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left text-sm font-medium">Name</th>
                    <th className="p-2 text-left text-sm font-medium">
                      Publisher
                    </th>
                    <th className="p-2 text-left text-sm font-medium">ISSN</th>
                    <th className="p-2 text-left text-sm font-medium">
                      Indexed In
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Annual Cost
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Access Type
                    </th>
                    <th className="p-2 text-left text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.map((journal) => (
                    <tr key={journal.id} className="border-b">
                      <td className="p-2 text-sm font-medium">{journal.name}</td>
                      <td className="p-2 text-sm">{journal.publisher || "—"}</td>
                      <td className="p-2 text-sm">{journal.issn || "—"}</td>
                      <td className="p-2 text-sm">
                        {journal.indexed_in && journal.indexed_in.length > 0
                          ? (journal.indexed_in as string[]).join(", ")
                          : "—"}
                      </td>
                      <td className="p-2 text-sm">
                        {journal.annual_cost
                          ? `₹${(journal.annual_cost / 100).toLocaleString(
                              "en-IN",
                              { minimumFractionDigits: 2 }
                            )}`
                          : "—"}
                      </td>
                      <td className="p-2 text-sm">
                        <Badge
                          variant={journal.is_online ? "default" : "outline"}
                        >
                          {journal.is_online ? "Online" : "Print"}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm">
                        <Badge
                          variant={
                            journal.subscription_status === "active"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {journal.subscription_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableWrapper>
          )}
        </CardContent>
      </Card>

      {/* Overdue Books */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Overdue Books
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!overdueBooks || overdueBooks.length === 0 ? (
            <EmptyState
              title="No overdue books"
              description="All books are returned on time."
            />
          ) : (
            <DataTableWrapper>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left text-sm font-medium">
                      Book ID
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Borrower ID
                    </th>
                    <th className="p-2 text-left text-sm font-medium">Type</th>
                    <th className="p-2 text-left text-sm font-medium">
                      Issued Date
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Due Date
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Overdue (Days)
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Fine (₹)
                    </th>
                    <th className="p-2 text-left text-sm font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overdueBooks.map((issuance) => {
                    const today = new Date();
                    const dueDate = new Date(issuance.due_date);
                    const overdueDays = Math.max(
                      0,
                      Math.floor(
                        (today.getTime() - dueDate.getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    );
                    const fine = issuance.fine_amount / 100; // paisa to rupees

                    return (
                      <tr key={issuance.id} className="border-b">
                        <td className="p-2 text-sm">{issuance.book_id}</td>
                        <td className="p-2 text-sm">{issuance.borrower_id}</td>
                        <td className="p-2 text-sm">
                          {issuance.borrower_type || "—"}
                        </td>
                        <td className="p-2 text-sm">
                          {new Date(issuance.issued_date).toLocaleDateString()}
                        </td>
                        <td className="p-2 text-sm text-orange-600">
                          {new Date(issuance.due_date).toLocaleDateString()}
                        </td>
                        <td className="p-2 text-sm font-bold text-red-600">
                          {overdueDays}
                        </td>
                        <td className="p-2 text-sm font-bold text-red-600">
                          ₹{fine.toFixed(2)}
                        </td>
                        <td className="p-2 text-sm">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedIssuanceId(issuance.id);
                              setReturnModalOpen(true);
                            }}
                          >
                            Return
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableWrapper>
          )}
        </CardContent>
      </Card>

      {/* Issue Book Modal */}
      <Dialog open={issueModalOpen} onOpenChange={setIssueModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Book</DialogTitle>
            <DialogDescription>
              Issue a book to a student, faculty, or staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="book-select">Select Book</Label>
              <Select value={selectedBook ?? ""} onValueChange={setSelectedBook}>
                <SelectTrigger id="book-select">
                  <SelectValue placeholder="Choose a book" />
                </SelectTrigger>
                <SelectContent>
                  {books
                    .filter((b) => b.status === "available" && b.available_copies > 0)
                    .map((book) => (
                      <SelectItem key={book.id} value={book.id}>
                        {book.title} ({book.available_copies} available)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="borrower-id">Borrower ID</Label>
              <Input
                id="borrower-id"
                placeholder="Enter borrower ID"
                value={borrowerId}
                onChange={(e) => setBorrowerId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="borrower-type">Borrower Type</Label>
              <Select value={borrowerType} onValueChange={setBorrowerType}>
                <SelectTrigger id="borrower-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleIssueBook}>Issue Book</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Book Modal */}
      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Book</DialogTitle>
            <DialogDescription>
              Return a book and calculate any applicable fine.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="issuance-select">Select Issuance</Label>
              <Select
                value={selectedIssuanceId ?? ""}
                onValueChange={setSelectedIssuanceId}
              >
                <SelectTrigger id="issuance-select">
                  <SelectValue placeholder="Choose an issuance" />
                </SelectTrigger>
                <SelectContent>
                  {overdueBooks &&
                    overdueBooks.map((issuance) => (
                      <SelectItem key={issuance.id} value={issuance.id}>
                        Book ID: {issuance.book_id.substring(0, 8)}... | Borrower:{" "}
                        {issuance.borrower_id.substring(0, 8)}... | Due:{" "}
                        {new Date(issuance.due_date).toLocaleDateString()}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReturnBook}>Return Book</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
