/*
c files
1. open/create a file fopen()
2. read from a file getc()
3. append to a file a
4. close a file fclose()
*/

#include<stdio.h>   //scanf(), printf()
#include<stdlib.h>  //exit()

//function prototype
void writetofile();
void readfromfile();

int main()
{
    //function call
    writetofile();
    readfromfile();

    return 0;
}

//function definition
void writetofile()
{
       FILE *fp;
       char paragraph[300];

       //fopen(path,mode); w,r,a
       fp = fopen("C:\\Users\\User\\OneDrive\\Desktop\\semester c- project\\file.txt", "w");

       if(fp==NULL)
       {
            printf("error opening a file \n");
            exit(1);
       }

       printf("Enter a paragraph: \n");

       //scanf("%[^\n]", paragraph);
       fgets(paragraph, sizeof(paragraph), stdin);

       //write to file
       fputs(paragraph, fp);

       printf("successfully written to file \n");

       fclose(fp);
}

void readfromfile()
{
       FILE *fp;
       int character;

       //fopen(path,mode); w,r,a
       fp = fopen("C:\\Users\\User\\OneDrive\\Desktop\\semester c- project\\file.txt", "r");

       if(fp==NULL)
       {
            printf("error opening a file \n");
            exit(1);
       }

       while((character = getc(fp)) != EOF)
       {
            putchar(character);
       }

       printf("\nsuccessfully read file \n");

       fclose(fp);
}
void appendtofile()
{
       FILE *fp;
       char paragraph[300];

       //fopen(path,mode); w,r,a
       fp = fopen("C:\\Users\\User\\OneDrive\\Desktop\\semester c- project\\file.txt", "a");

       if(fp==NULL)
       {
            printf("error opening a file \n");
            exit(1);
       }

       printf("Enter text to append: \n");

       fgets(paragraph, sizeof(paragraph), stdin);

       //append to file
       fputs(paragraph, fp);

       printf("successfully appended to file \n");

       fclose(fp);
}
